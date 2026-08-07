import Link from 'next/link';
import type { Metadata } from 'next';
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
import { ClearCart } from '@/components/clear-cart';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Gracias por tu compra' };

type StoredReportInput = {
  previewUrl?: string | null;
};

const reportStatusLabels: Record<string, string> = {
  pending: 'Pendiente',
  queued: 'En espera',
  running: 'Generando',
};

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
      report.status !== 'skipped',
  );
  const failedReports = reportRows.filter((report) => report.status === 'error');

  const isPaid = order?.status === 'paid' || order?.status === 'fulfilled';

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <ClearCart />
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-3xl font-bold text-white shadow-lg shadow-[hsl(var(--primary))]/25">
          ✓
        </div>
        <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
          ¡Gracias por tu compra!
        </h1>
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

      {order && (
        <section className="relative mt-10 overflow-hidden rounded-2xl border-2 border-[hsl(var(--primary))]/25 bg-[hsl(var(--card))] shadow-xl shadow-[hsl(var(--primary))]/10">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-brand" />
          <div className="flex flex-col gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--primary-soft))]/50 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[hsl(var(--primary))]">
                Compra confirmada
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">Esto es lo que compraste</h2>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-3.5 py-1.5 text-sm font-bold text-[hsl(var(--primary-foreground))] shadow-sm">
              <span aria-hidden="true">✓</span> Pago aprobado
            </span>
          </div>

          <ul className="space-y-3 p-5 sm:p-6">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-4 rounded-xl border border-[hsl(var(--primary))]/20 bg-gradient-to-br from-[hsl(var(--primary-soft))] to-[hsl(var(--card))] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
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
            <span className="font-semibold text-[hsl(var(--muted-foreground))]">Total pagado</span>
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

      {order && !isPaid && (
        <p className="mt-8 text-center text-base text-[hsl(var(--muted-foreground))]">
          Estamos confirmando tu pago. Si compraste productos digitales, tus enlaces
          aparecerán aquí en unos segundos; actualiza la página.
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
