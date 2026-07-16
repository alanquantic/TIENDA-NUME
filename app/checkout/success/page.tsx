import Link from 'next/link';
import type { Metadata } from 'next';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  digitalAssets,
  downloadGrants,
  generatedReports,
  orderItems,
  orders,
} from '@/lib/db/schema';
import { formatDecimal } from '@/lib/money';
import { ClearCart } from '@/components/clear-cart';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Gracias por tu compra' };

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: { order?: string };
}) {
  const orderId = searchParams.order;
  const order = orderId
    ? (await db.select().from(orders).where(eq(orders.id, orderId)).limit(1))[0]
    : null;

  const items = order
    ? await db.select().from(orderItems).where(eq(orderItems.orderId, order.id))
    : [];

  const downloads = order
    ? await db
        .select({
          token: downloadGrants.token,
          fileName: digitalAssets.fileName,
        })
        .from(downloadGrants)
        .innerJoin(digitalAssets, eq(downloadGrants.digitalAssetId, digitalAssets.id))
        .where(eq(downloadGrants.orderId, order.id))
    : [];

  const reports = order
    ? await db
        .select({ name: generatedReports.productName, url: generatedReports.url })
        .from(generatedReports)
        .where(and(eq(generatedReports.orderId, order.id), eq(generatedReports.status, 'ready')))
    : [];

  const isPaid = order?.status === 'paid' || order?.status === 'fulfilled';

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <ClearCart />
      <div className="text-center">
        <div className="text-4xl">✓</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">¡Gracias por tu compra!</h1>
        {order ? (
          <p className="mt-2 text-[hsl(var(--muted-foreground))]">
            Pedido <span className="font-medium">{order.number}</span> · confirmación
            enviada a {order.customerEmail}
          </p>
        ) : (
          <p className="mt-2 text-[hsl(var(--muted-foreground))]">
            Tu pago se está procesando. Revisa tu correo en unos minutos.
          </p>
        )}
      </div>

      {order && (
        <div className="mt-10 border border-[hsl(var(--border))] rounded-xl p-6">
          <ul className="divide-y divide-[hsl(var(--border))]">
            {items.map((i) => (
              <li key={i.id} className="py-3 flex justify-between gap-2">
                <span>
                  {i.name}
                  {i.variantName ? ` — ${i.variantName}` : ''} × {i.quantity}
                </span>
                <span className="font-medium">
                  {formatDecimal(i.totalAmount, order.currency)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 pt-4 border-t border-[hsl(var(--border))] flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatDecimal(order.totalAmount, order.currency)}</span>
          </div>
        </div>
      )}

      {reports.length > 0 && (
        <div className="mt-8">
          <h2 className="font-semibold mb-3">Tus reportes</h2>
          <ul className="space-y-2">
            {reports.map((r) => (
              <li key={r.url}>
                <a
                  href={r.url ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-4 py-2 hover:bg-[hsl(var(--muted))]"
                >
                  📄 {r.name ?? 'Reporte'}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {downloads.length > 0 && (
        <div className="mt-8">
          <h2 className="font-semibold mb-3">Tus descargas</h2>
          <ul className="space-y-2">
            {downloads.map((d) => (
              <li key={d.token}>
                <a
                  href={`/api/descargas/${d.token}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-4 py-2 hover:bg-[hsl(var(--muted))]"
                >
                  ⬇ {d.fileName}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {order && !isPaid && (
        <p className="mt-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
          Estamos confirmando tu pago. Si compraste productos digitales, tus enlaces
          aparecerán aquí en unos segundos — actualiza la página.
        </p>
      )}

      <div className="mt-10 text-center">
        <Link href="/" className="underline underline-offset-4">
          Seguir comprando
        </Link>
      </div>
    </div>
  );
}
