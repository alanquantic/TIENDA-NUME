import Link from 'next/link';
import { desc, eq, sql } from 'drizzle-orm';
import { adminHref } from '@/lib/admin-path';
import { db } from '@/lib/db';
import { generatedReports, orders } from '@/lib/db/schema';
import { ReportRetryButton } from '@/components/admin/report-retry-button';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  queued: 'En cola',
  running: 'Generando',
  ready: 'Listo',
  error: 'Error',
  skipped: 'Omitido',
  failed: 'Fallido',
};

function statusClass(status: string): string {
  if (status === 'ready') return 'text-green-600';
  if (status === 'error' || status === 'failed') return 'text-red-500';
  if (status === 'skipped') return 'text-[hsl(var(--muted-foreground))]';
  return 'text-amber-600';
}

const fmtDate = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Mexico_City',
});

export default async function AdminReports() {
  const matches = await db
    .select({
      id: generatedReports.id,
      status: generatedReports.status,
      reportKey: generatedReports.reportKey,
      productName: generatedReports.productName,
      orderId: generatedReports.orderId,
      orderNumber: orders.number,
      url: generatedReports.url,
      error: generatedReports.error,
      input: generatedReports.input,
      updatedAt: generatedReports.updatedAt,
    })
    .from(generatedReports)
    .innerJoin(orders, eq(orders.id, generatedReports.orderId))
    // Los no-listos primero: son los que piden atención (el cron los reintenta
    // o ya se rindió); dentro de cada grupo, lo más reciente arriba.
    .orderBy(
      sql`case when ${generatedReports.status} = 'ready' then 1 else 0 end`,
      desc(generatedReports.updatedAt),
    )
    .limit(201);
  const rows = matches.slice(0, 200);

  return (
    <div>
      <div className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold">Reportes</h1>
        <p className="max-w-2xl text-sm text-[hsl(var(--muted-foreground))]">
          Reportes generados por pedido. El cron horario reintenta los pendientes y con error
          hasta 5 veces; un reporte fallido ya no se toca solo. «Reintentar» lo reencola desde
          cero y el cron lo reenvía en su siguiente corrida.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-[hsl(var(--muted-foreground))]">Aún no hay reportes.</p>
      ) : (
        <>
          <p role="status" className="mb-3 text-sm text-[hsl(var(--muted-foreground))]">
            {matches.length > 200
              ? 'Mostrando 200 reportes (los no listos y los más recientes primero).'
              : `${rows.length} reporte${rows.length === 1 ? '' : 's'}.`}
          </p>
          <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
            <table className="w-full text-sm">
              <thead className="border-b border-[hsl(var(--border))] text-left text-[hsl(var(--muted-foreground))]">
                <tr>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Reporte</th>
                  <th className="px-4 py-3 font-medium">Pedido</th>
                  <th className="px-4 py-3 font-medium">Error</th>
                  <th className="px-4 py-3 font-medium">Actualizado</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {rows.map((r) => {
                  const attempts = (r.input as { attempts?: number } | null)?.attempts;
                  const retryable = r.status === 'error' || r.status === 'failed';
                  return (
                    <tr key={r.id} className="hover:bg-[hsl(var(--muted))]">
                      <td className={`whitespace-nowrap px-4 py-3 ${statusClass(r.status)}`}>
                        {STATUS_LABEL[r.status] ?? r.status}
                        {typeof attempts === 'number' && attempts > 0 && (
                          <div className="text-xs text-[hsl(var(--muted-foreground))]">
                            {attempts} intento{attempts === 1 ? '' : 's'}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{r.reportKey}</div>
                        <div className="text-xs text-[hsl(var(--muted-foreground))]">
                          {r.productName ?? '—'}
                        </div>
                        {r.status === 'ready' && r.url && (
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs hover:underline"
                          >
                            Ver PDF ↗
                          </a>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <Link href={adminHref(`/pedidos/${r.orderId}`)} className="hover:underline">
                          {r.orderNumber}
                        </Link>
                      </td>
                      <td className="max-w-xs px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">
                        <span className="line-clamp-3 break-words" title={r.error ?? undefined}>
                          {r.error ?? '—'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[hsl(var(--muted-foreground))]">
                        {fmtDate.format(r.updatedAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {retryable && <ReportRetryButton reportId={r.id} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
