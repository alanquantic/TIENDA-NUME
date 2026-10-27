import Link from 'next/link';
import { and, count, desc, eq, gte, isNotNull, type SQL } from 'drizzle-orm';
import { adminHref } from '@/lib/admin-path';
import { db } from '@/lib/db';
import { emailMessages, orders } from '@/lib/db/schema';
import { EMAIL_KIND_LABEL, EMAIL_STATUS_LABEL, emailStatusClass } from '@/lib/admin/email-labels';

export const dynamic = 'force-dynamic';

const fmtDate = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Mexico_City',
});

const PERIODS: Record<string, { label: string; days: number | null }> = {
  '7': { label: 'Últimos 7 días', days: 7 },
  '30': { label: 'Últimos 30 días', days: 30 },
  '90': { label: 'Últimos 90 días', days: 90 },
  todo: { label: 'Todo', days: null },
};

function pct(part: number, total: number): string {
  return total === 0 ? '—' : `${Math.round((part / total) * 100)}%`;
}

export default async function AdminEmails({ searchParams }: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const kind = typeof searchParams.tipo === 'string' && EMAIL_KIND_LABEL[searchParams.tipo] ? searchParams.tipo : '';
  const periodKey = typeof searchParams.periodo === 'string' && PERIODS[searchParams.periodo] ? searchParams.periodo : '30';
  const days = PERIODS[periodKey].days;

  const conditions: SQL[] = [];
  if (kind) conditions.push(eq(emailMessages.kind, kind));
  if (days) conditions.push(gte(emailMessages.sentAt, new Date(Date.now() - days * 86_400_000)));
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [totals], [delivered], [opened], [clicked]] = await Promise.all([
    db
      .select({ message: emailMessages, orderNumber: orders.number })
      .from(emailMessages)
      .leftJoin(orders, eq(orders.id, emailMessages.orderId))
      .where(where)
      .orderBy(desc(emailMessages.sentAt))
      .limit(200),
    db.select({ n: count() }).from(emailMessages).where(where),
    db.select({ n: count() }).from(emailMessages).where(and(where, eq(emailMessages.status, 'delivered'))),
    db.select({ n: count() }).from(emailMessages).where(and(where, isNotNull(emailMessages.openedAt))),
    db.select({ n: count() }).from(emailMessages).where(and(where, isNotNull(emailMessages.clickedAt))),
  ]);

  const fieldClass = 'h-11 w-full min-w-0 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm outline-none focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20';
  const stats = [
    { label: 'Enviados', value: totals.n.toLocaleString('es-MX'), hint: '' },
    { label: 'Entregados', value: delivered.n.toLocaleString('es-MX'), hint: pct(delivered.n, totals.n) },
    { label: 'Abiertos', value: opened.n.toLocaleString('es-MX'), hint: pct(opened.n, totals.n) },
    { label: 'Con clic', value: clicked.n.toLocaleString('es-MX'), hint: pct(clicked.n, totals.n) },
  ];

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold">Correos</h1>
      <p className="mb-6 text-sm text-[hsl(var(--muted-foreground))]">
        Correos que manda la tienda por Resend. Entregas, aperturas y clics llegan por su webhook; las
        aperturas son aproximadas (algunos clientes de correo bloquean el pixel).
      </p>

      <form action={adminHref('/correos')} method="get" className="mb-6 grid gap-4 rounded-xl border border-[hsl(var(--border))] p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="min-w-0">
          <label htmlFor="email-kind" className="mb-1.5 block text-sm font-medium">Tipo de correo</label>
          <select id="email-kind" name="tipo" defaultValue={kind} className={fieldClass}>
            <option value="">Todos</option>
            {Object.entries(EMAIL_KIND_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor="email-period" className="mb-1.5 block text-sm font-medium">Periodo</label>
          <select id="email-period" name="periodo" defaultValue={periodKey} className={fieldClass}>
            {Object.entries(PERIODS).map(([value, p]) => <option key={value} value={value}>{p.label}</option>)}
          </select>
        </div>
        <button type="submit" className="h-11 rounded-lg bg-[hsl(var(--primary))] px-4 text-sm font-semibold text-white hover:opacity-90">Aplicar</button>
      </form>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-[hsl(var(--border))] p-4">
            <div className="text-xs text-[hsl(var(--muted-foreground))]">{s.label}</div>
            <div className="mt-1 text-2xl font-semibold">{s.value}</div>
            {s.hint && <div className="text-xs text-[hsl(var(--muted-foreground))]">{s.hint} de los enviados</div>}
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-[hsl(var(--muted-foreground))]">No hay correos en este periodo.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
          <table className="w-full text-sm">
            <thead className="border-b border-[hsl(var(--border))] text-left text-[hsl(var(--muted-foreground))]">
              <tr>
                <th className="px-4 py-3 font-medium">Correo</th>
                <th className="px-4 py-3 font-medium">Destinatario</th>
                <th className="px-4 py-3 font-medium">Pedido</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Apertura / clic</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {rows.map(({ message: m, orderNumber }) => (
                <tr key={m.id} className="align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">{EMAIL_KIND_LABEL[m.kind] ?? m.kind}</div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">{fmtDate.format(m.sentAt)}</div>
                  </td>
                  <td className="break-all px-4 py-3">{m.toEmail}</td>
                  <td className="px-4 py-3">
                    {m.orderId && orderNumber ? (
                      <Link href={adminHref(`/pedidos/${m.orderId}`)} className="hover:underline">{orderNumber}</Link>
                    ) : '—'}
                  </td>
                  <td className={`px-4 py-3 ${emailStatusClass(m.status)}`}>
                    {EMAIL_STATUS_LABEL[m.status] ?? m.status}
                    {m.error && <div className="text-xs text-red-500">{m.error}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">
                    <div>{m.openedAt ? `Abierto ${fmtDate.format(m.openedAt)}${m.openCount > 1 ? ` (${m.openCount}×)` : ''}` : 'Sin abrir'}</div>
                    <div>{m.clickedAt ? `Clic ${fmtDate.format(m.clickedAt)}${m.clickCount > 1 ? ` (${m.clickCount}×)` : ''}` : 'Sin clic'}</div>
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
