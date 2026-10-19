import Link from 'next/link';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  digitalAssets,
  downloadGrants,
  generatedReports,
  orderItems,
  orders,
} from '@/lib/db/schema';
import { formatDecimal } from '@/lib/money';
import type { EcommerceItem } from '@/lib/analytics';
import { PurchaseTracker } from '@/components/analytics/purchase-tracker';
import { ClearCart } from '@/components/clear-cart';
import { PendingPaymentRefresh } from '@/components/pending-payment-refresh';
import { ORDER_ACCESS_COOKIE, readOrderAccess } from '@/lib/order-access';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Tu pedido' };

type StoredReportInput = {
  previewUrl?: string | null;
};

const reportStatusLabels: Record<string, string> = {
  pending: 'Pendiente',
  queued: 'En espera',
  running: 'Generando',
};

/**
 * El pedido se identifica SOLO con la cookie firmada que fija /api/checkout
 * (nunca con un parámetro de la URL). Sin cookie válida —otro dispositivo o
 * más de 24 h— se muestra el mensaje genérico de "revisa tu correo".
 */
export default async function SuccessPage() {
  const orderId = readOrderAccess(cookies().get(ORDER_ACCESS_COOKIE)?.value);
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

  const reportRows = order
    ? await db
        .select({
          name: generatedReports.productName,
          url: generatedReports.url,
          status: generatedReports.status,
          input: generatedReports.input,
        })
        .from(generatedReports)
        .where(eq(generatedReports.orderId, order.id))
    : [];

  const readyReports = reportRows
    .filter((report) => report.status === 'ready' && report.url)
    .map((report) => ({
      name: report.name ?? 'Reporte',
      pdfUrl: report.url as string,
      previewUrl: ((report.input ?? {}) as StoredReportInput).previewUrl ?? null,
    }));

  const pendingReports = reportRows.filter(
    (report) =>
      report.status !== 'ready' &&
      report.status !== 'error' &&
      report.status !== 'skipped' &&
      report.status !== 'failed',
  );
  const failedReports = reportRows.filter(
    (report) => report.status === 'error' || report.status === 'failed',
  );

  const isPaid =
    order?.status === 'paid' ||
    order?.status === 'fulfilled' ||
    order?.status === 'partially_refunded';
  // Mercado Pago también regresa aquí con pagos en espera (OXXO, transferencia,
  // tarjeta en revisión): no se dice "pago aprobado" hasta que lo confirme el aviso.
  const isPending = order?.status === 'pending';
  const isClosed = order?.status === 'cancelled' || order?.status === 'refunded';

  // Prepara payload de purchase (dedup por order.number en el tracker).
  const purchaseItems: EcommerceItem[] =
    order && isPaid
      ? items.map((it) => ({
          item_id: it.variantId ?? it.id,
          item_name: it.name,
          item_variant: it.variantName ?? undefined,
          price: Number.parseFloat(it.unitAmount ?? it.totalAmount ?? '0') || 0,
          quantity: Number(it.quantity ?? 1),
          currency: order.currency,
        }))
      : [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      {order && isPaid && purchaseItems.length > 0 ? (
        <PurchaseTracker
          transactionId={order.number ?? order.id}
          currency={order.currency}
          value={Number.parseFloat(order.totalAmount ?? '0') || 0}
          items={purchaseItems}
          shipping={
            order.shippingAmount
              ? Number.parseFloat(order.shippingAmount) || undefined
              : undefined
          }
          tax={order.taxAmount ? Number.parseFloat(order.taxAmount) || undefined : undefined}
          coupon={order.discountCode ?? undefined}
        />
      ) : null}
      {/* El carrito solo se vacía si el pedido sigue vivo (pagado o por confirmar). */}
      {!isClosed && <ClearCart />}
      {isPending && <PendingPaymentRefresh />}
      <div className="text-center">
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl font-bold shadow-lg ${
            isPending
              ? 'bg-amber-500 text-white shadow-amber-500/25'
              : isClosed
                ? 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'
                : 'bg-[hsl(var(--primary))] text-white shadow-[hsl(var(--primary))]/25'
          }`}
        >
          {isPending ? '⏳' : isClosed ? '✕' : '✓'}
        </div>
        <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
          {isPending
            ? 'Tu pago está por confirmarse'
            : isClosed
              ? 'Este pedido no se completó'
              : '¡Gracias por tu compra!'}
        </h1>
        {order ? (
          <p className="mt-2 text-[hsl(var(--muted-foreground))]">
            Pedido <span className="font-medium">{order.number}</span>
            {isPaid && <> · confirmación enviada a {order.customerEmail}</>}
          </p>
        ) : (
          <p className="mt-2 text-[hsl(var(--muted-foreground))]">
            Revisa tu correo en unos minutos o consulta tus pedidos en{' '}
            <Link href="/cuenta" className="underline underline-offset-4">
              tu cuenta
            </Link>
            .
          </p>
        )}
      </div>

      {isPending && order && (
        <div className="mt-8 rounded-xl border-2 border-amber-500/40 bg-amber-500/10 p-5 text-center">
          <p className="text-lg font-semibold text-amber-700 dark:text-amber-300">
            Aún no recibimos la confirmación de tu pago
          </p>
          <p className="mt-2 text-base leading-relaxed">
            Si pagaste con tarjeta, esta página se actualizará sola en unos segundos. Si
            elegiste pagar en efectivo (OXXO) o por transferencia, tu pedido quedará
            confirmado cuando se acredite el pago; en ese momento te enviaremos la
            confirmación a <strong>{order.customerEmail}</strong>.
          </p>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            Si el pago no se completó, no se hizo ningún cargo y puedes intentarlo de nuevo
            desde{' '}
            <Link href="/carrito" className="underline underline-offset-4">
              tu carrito
            </Link>
            . Puedes revisar el estado del pago en tu cuenta de Mercado Pago o PayPal.
          </p>
        </div>
      )}

      {isClosed && (
        <div className="mt-8 rounded-xl border border-[hsl(var(--border))] p-5 text-center">
          <p className="text-base leading-relaxed">
            No recibimos el pago de este pedido, así que{' '}
            <strong>no se realizó ningún cargo</strong>. Puedes volver a intentarlo cuando
            quieras.
          </p>
          <Link
            href="/carrito"
            className="mt-4 inline-block rounded-lg bg-[hsl(var(--primary))] px-5 py-2.5 font-medium text-[hsl(var(--primary-foreground))]"
          >
            Volver al carrito
          </Link>
        </div>
      )}

      {(isPaid || !order) && (
        <div className="mt-8 rounded-xl border-2 border-[hsl(var(--primary))] bg-[hsl(var(--primary-soft))] p-5 text-center">
          <p className="text-lg font-semibold text-[hsl(var(--primary))]">
            📩 Muy importante: revisa tu correo electrónico
          </p>
          <p className="mt-2 text-base leading-relaxed">
            {order ? (
              <>
                Te enviamos a <strong>{order.customerEmail}</strong> la confirmación de tu
                compra y tus reportes para descargar.
              </>
            ) : (
              <>
                En tu correo recibirás la confirmación de tu compra y tus reportes para
                descargar.
              </>
            )}{' '}
            Si no lo encuentras en unos minutos, busca en la carpeta de{' '}
            <strong>spam o &ldquo;Promociones&rdquo;</strong>.
          </p>
        </div>
      )}

      {order && !isClosed && (
        <section className="relative mt-10 overflow-hidden rounded-2xl border-2 border-[hsl(var(--primary))]/25 bg-[hsl(var(--card))] shadow-xl shadow-[hsl(var(--primary))]/10">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-brand" />
          <div className="flex flex-col gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--primary-soft))]/50 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[hsl(var(--primary))]">
                {isPaid ? 'Compra confirmada' : 'Pedido registrado'}
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">
                {isPaid ? 'Esto es lo que compraste' : 'Esto es lo que pediste'}
              </h2>
            </div>
            {isPaid ? (
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-3.5 py-1.5 text-sm font-bold text-[hsl(var(--primary-foreground))] shadow-sm">
                <span aria-hidden="true">✓</span> Pago aprobado
              </span>
            ) : (
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-amber-500 px-3.5 py-1.5 text-sm font-bold text-white shadow-sm">
                <span aria-hidden="true">⏳</span> Pago por confirmar
              </span>
            )}
          </div>

          <ul className="space-y-3 p-5 sm:p-6">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-4 rounded-xl border border-[hsl(var(--primary))]/20 bg-primary-soft p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
              >
                <div className="flex items-center gap-4">
                  <span
                    aria-hidden="true"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--primary))] text-2xl text-[hsl(var(--primary-foreground))] shadow-md shadow-[hsl(var(--primary))]/20"
                  >
                    ✦
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--primary))]">
                      Tu producto
                    </p>
                    <p className="mt-0.5 text-lg font-bold leading-tight sm:text-xl">
                      {item.name}
                    </p>
                    <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                      {item.variantName ? `${item.variantName} · ` : ''}Cantidad: {item.quantity}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-xl font-bold text-[hsl(var(--primary))] sm:text-2xl">
                  {formatDecimal(item.totalAmount, order.currency)}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 px-6 py-4">
            <span className="font-semibold text-[hsl(var(--muted-foreground))]">
              {isPaid ? 'Total pagado' : 'Total por pagar'}
            </span>
            <span className="text-2xl font-extrabold text-[hsl(var(--foreground))]">
              {formatDecimal(order.totalAmount, order.currency)}
            </span>
          </div>
        </section>
      )}

      {pendingReports.length > 0 && (
        <div className="mt-8 rounded-xl border-2 border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary-soft))]/70 p-6 shadow-sm">
          <h2 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-[hsl(var(--primary))]">
            <span
              aria-hidden="true"
              className="h-6 w-6 shrink-0 animate-spin rounded-full border-[3px] border-[hsl(var(--primary))]/25 border-t-[hsl(var(--primary))]"
            />
            Tus reportes se están generando
          </h2>
          <p className="mt-3 text-base font-medium leading-relaxed text-[hsl(var(--foreground))]/80">
            Algunos reportes usan generación dinámica. Ya estamos preparándolos y te los
            enviaremos por correo en cuanto estén listos. El tiempo estimado es de 5 a
            30 minutos.
          </p>
          <ul className="mt-4 space-y-2 text-base">
            {pendingReports.map((report, index) => (
              <li
                key={`${report.name ?? 'reporte'}-${index}`}
                className="flex flex-col gap-3 rounded-xl border border-[hsl(var(--primary))]/20 bg-[hsl(var(--card))] p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="flex items-center gap-3 font-bold">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary-soft))] text-[hsl(var(--primary))]"
                  >
                    ✦
                  </span>
                  {report.name ?? 'Reporte'}
                </span>
                <span className="w-fit rounded-full border border-[hsl(var(--primary))]/20 bg-[hsl(var(--primary-soft))] px-3 py-1 text-sm font-bold text-[hsl(var(--primary))]">
                  {reportStatusLabels[report.status] ?? report.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {readyReports.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-1 text-xl font-semibold">Tus reportes</h2>
          <p className="mb-3 text-sm text-[hsl(var(--muted-foreground))]">
            👇 Abre la vista web o descarga el PDF de cada reporte.
          </p>
          <ul className="space-y-3">
            {readyReports.map((report) => (
              <li
                key={`${report.name}-${report.pdfUrl}`}
                className="rounded-xl border border-[hsl(var(--border))] p-4"
              >
                <p className="font-medium">{report.name}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {report.previewUrl && (
                    <a
                      href={report.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-4 py-2 text-sm font-medium hover:bg-[hsl(var(--muted))]"
                    >
                      Ver reporte
                    </a>
                  )}
                  <a
                    href={report.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-4 py-2 text-sm font-medium hover:bg-[hsl(var(--muted))]"
                  >
                    Descargar PDF
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {downloads.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-1 text-xl font-semibold">Tus descargas</h2>
          <p className="mb-3 text-sm text-[hsl(var(--muted-foreground))]">
            👇 Da clic en un botón para descargar tu archivo.
          </p>
          <ul className="space-y-2">
            {downloads.map((download) => (
              <li key={download.token}>
                <a
                  href={`/api/descargas/${download.token}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-5 py-2.5 text-base font-medium hover:bg-[hsl(var(--muted))]"
                >
                  ⬇️ {download.fileName}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {failedReports.length > 0 && (
        <p className="mt-8 text-center text-sm text-red-500">
          Hay reportes que aún no pudieron terminarse. Intenta actualizar esta página
          más tarde.
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
