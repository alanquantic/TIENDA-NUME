import Link from 'next/link';
import { and, asc, desc, eq, exists, gte, lt, sql, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orderItems, orders, products } from '@/lib/db/schema';
import { formatDecimal } from '@/lib/money';
import { parseOrderFilters } from '@/lib/admin/order-filters';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  paid: 'Pagado',
  fulfilled: 'Entregado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
  partially_refunded: 'Reemb. parcial',
};

function statusClass(status: string): string {
  if (status === 'paid' || status === 'fulfilled') return 'text-green-600';
  if (status === 'pending') return 'text-amber-600';
  return 'text-[hsl(var(--muted-foreground))]';
}

const fmtDate = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Mexico_City',
});

export default async function AdminOrders({ searchParams }: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = parseOrderFilters(searchParams);
  const conditions: SQL[] = [];
  if (filters.productId) {
    // EXISTS keeps mixed orders unique, even when several variants match.
    conditions.push(exists(db.select({ id: orderItems.id }).from(orderItems).where(and(
      eq(orderItems.orderId, orders.id), eq(orderItems.productId, filters.productId),
    ))));
  }
  if (filters.from) {
    conditions.push(gte(orders.createdAt, sql`${filters.from}::date::timestamp AT TIME ZONE 'America/Mexico_City'`));
  }
  if (filters.to) {
    // Exclusive next-day boundary includes every instant of the selected last day.
    conditions.push(lt(orders.createdAt, sql`(${filters.to}::date + 1)::timestamp AT TIME ZONE 'America/Mexico_City'`));
  }
  const [productOptions, matches] = await Promise.all([
    db.select({ id: products.id, name: products.name }).from(products).orderBy(asc(products.name)),
    filters.error ? Promise.resolve([]) : db.select().from(orders).where(and(...conditions))
      .orderBy(desc(orders.createdAt), desc(orders.id)).limit(201),
  ]);
  const rows = matches.slice(0, 200);
  const hasFilters = Boolean(filters.productId || filters.from || filters.to);
  const fieldClass = 'h-11 w-full min-w-0 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm outline-none focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20';

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Pedidos</h1>

      <form action="/admin/pedidos" method="get" className="mb-6 grid gap-4 rounded-xl border border-[hsl(var(--border))] p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="min-w-0 sm:col-span-2 lg:col-span-1">
          <label htmlFor="order-product" className="mb-1.5 block text-sm font-medium">Producto</label>
          <select id="order-product" name="producto" defaultValue={filters.productId} className={fieldClass}>
            <option value="">Todos los productos</option>
            {productOptions.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor="order-from" className="mb-1.5 block text-sm font-medium">Desde</label>
          <input id="order-from" name="desde" type="date" defaultValue={filters.from} max={filters.to || undefined} className={fieldClass} />
        </div>
        <div className="min-w-0">
          <label htmlFor="order-to" className="mb-1.5 block text-sm font-medium">Hasta</label>
          <input id="order-to" name="hasta" type="date" defaultValue={filters.to} min={filters.from || undefined} className={fieldClass} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2 lg:col-span-3">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Fecha de creación del pedido · Ciudad de México.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin/pedidos" className="inline-flex h-11 items-center rounded-lg border border-[hsl(var(--border))] px-4 text-sm font-medium hover:bg-[hsl(var(--muted))]">Limpiar filtros</Link>
            <button type="submit" className="h-11 rounded-lg bg-[hsl(var(--primary))] px-4 text-sm font-semibold text-white hover:opacity-90">Aplicar filtros</button>
          </div>
        </div>
      </form>

      {filters.error ? (
        <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">{filters.error}</p>
      ) : rows.length === 0 ? (
        <p className="text-[hsl(var(--muted-foreground))]">{hasFilters ? 'No hay pedidos que coincidan con estos filtros.' : 'Aún no hay pedidos.'}</p>
      ) : (
        <>
        <p role="status" className="mb-3 text-sm text-[hsl(var(--muted-foreground))]">
          {matches.length > 200 ? 'Mostrando los 200 pedidos más recientes. Ajusta los filtros para acotar los resultados.' : `${rows.length} pedido${rows.length === 1 ? '' : 's'}${hasFilters ? ' con estos filtros' : ''}.`}
        </p>
        <div className="overflow-x-auto border border-[hsl(var(--border))] rounded-xl">
          <table className="w-full text-sm">
            <thead className="text-left text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))]">
              <tr>
                <th className="px-4 py-3 font-medium">Pedido</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {rows.map((o) => (
                <tr key={o.id} className="hover:bg-[hsl(var(--muted))]">
                  <td className="px-4 py-3">
                    <Link href={`/admin/pedidos/${o.id}`} className="font-medium hover:underline">
                      {o.number}
                    </Link>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {o.requiresShipping && (
                        <span className="rounded-full border border-[hsl(var(--border))] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                          Envío
                        </span>
                      )}
                      {o.requiresInvoice && (
                        <span className="rounded-full border border-[hsl(var(--border))] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                          Factura
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                    {fmtDate.format(o.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      {o.customerFirstName || o.customerLastName
                        ? `${o.customerFirstName ?? ''} ${o.customerLastName ?? ''}`.trim()
                        : '—'}
                    </div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      {o.customerEmail}
                    </div>
                  </td>
                  <td className={`px-4 py-3 ${statusClass(o.status)}`}>
                    {STATUS_LABEL[o.status] ?? o.status}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatDecimal(o.totalAmount, o.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
