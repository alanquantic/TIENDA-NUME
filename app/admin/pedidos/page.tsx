import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { formatDecimal } from '@/lib/money';

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
});

export default async function AdminOrders() {
  const rows = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(200);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Pedidos</h1>

      {rows.length === 0 ? (
        <p className="text-[hsl(var(--muted-foreground))]">Aún no hay pedidos.</p>
      ) : (
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
      )}
    </div>
  );
}
