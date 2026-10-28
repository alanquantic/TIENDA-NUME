import Link from 'next/link';
import { adminHref } from '@/lib/admin-path';
import { config } from '@/lib/config';
import { formatUsd } from '@/lib/admin/email-labels';
import { monthRange } from '@/lib/admin/order-filters';
import { salesMetrics } from '@/lib/admin/metrics';
import { formatDecimal } from '@/lib/money';

export const dynamic = 'force-dynamic';

const monthLabel = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const dayLabel = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function currentMonth(): string {
  // Mes en curso en hora de Ciudad de México.
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Mexico_City' }).format(new Date()).slice(0, 7);
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

function pct(part: number, total: number): string {
  return total === 0 ? '—' : `${Math.round((part / total) * 100)}%`;
}

const money = (value: number) => formatDecimal(value, config.currency);

export default async function AdminMetrics({ searchParams }: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const requested = typeof searchParams.mes === 'string' ? searchParams.mes : '';
  const month = monthRange(requested) ? requested : currentMonth();
  const { from, to } = monthRange(month)!;
  const m = await salesMetrics(from, to);
  const title = monthLabel.format(new Date(`${from}T12:00:00Z`));

  const tiles = [
    { label: 'Ventas', value: money(m.revenue), hint: `${m.orders} pedido${m.orders === 1 ? '' : 's'} pagado${m.orders === 1 ? '' : 's'}` },
    { label: 'Ticket promedio', value: m.orders ? money(m.averageTicket) : '—', hint: 'por pedido pagado' },
    { label: 'Descuentos', value: money(m.discounts), hint: 'cupones aplicados' },
    { label: 'Costo IA', value: formatUsd(m.ai.production), hint: `${m.ai.reports} reporte${m.ai.reports === 1 ? '' : 's'} · tokens ${formatUsd(m.ai.tokens)}` },
  ];
  const carts = m.carts;
  const cartTiles = [
    { label: 'Carritos guardados', value: carts.saved.toLocaleString('es-MX'), hint: 'con correo en el checkout' },
    { label: 'Avisados', value: carts.notified.toLocaleString('es-MX'), hint: `${pct(carts.clicked, carts.notified)} abrió el enlace` },
    { label: 'Recuperados', value: carts.recovered.toLocaleString('es-MX'), hint: `${pct(carts.recovered, carts.notified)} de los avisados · ${money(carts.recoveredAmount)}` },
    { label: 'Sin comprar', value: carts.open.toLocaleString('es-MX'), hint: `${money(carts.openAmount)} en carritos abiertos` },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Métricas</h1>
          <p className="text-sm capitalize text-[hsl(var(--muted-foreground))]">{title}</p>
        </div>
        <form action={adminHref('/metricas')} method="get" className="flex flex-wrap items-center gap-2">
          <Link href={adminHref(`/metricas?mes=${shiftMonth(month, -1)}`)} aria-label="Mes anterior" className="inline-flex h-11 items-center rounded-lg border border-[hsl(var(--border))] px-3 text-sm hover:bg-[hsl(var(--muted))]">←</Link>
          <label htmlFor="metrics-month" className="sr-only">Mes</label>
          <input id="metrics-month" name="mes" type="month" defaultValue={month} className="h-11 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm" />
          <button type="submit" className="h-11 rounded-lg bg-[hsl(var(--primary))] px-4 text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:opacity-90">Ver</button>
          <Link href={adminHref(`/metricas?mes=${shiftMonth(month, 1)}`)} aria-label="Mes siguiente" className="inline-flex h-11 items-center rounded-lg border border-[hsl(var(--border))] px-3 text-sm hover:bg-[hsl(var(--muted))]">→</Link>
        </form>
      </div>

      <p className="mb-4 text-xs text-[hsl(var(--muted-foreground))]">
        Solo pedidos reales pagados ({config.currency}, hora de Ciudad de México).
        {m.testOrders > 0 && ` Se excluyen ${m.testOrders} pedido${m.testOrders === 1 ? '' : 's'} de prueba.`}
      </p>

      <Tiles tiles={tiles} />

      <section className="mt-6 rounded-xl border border-[hsl(var(--border))] p-5">
        <h2 className="font-medium">Ventas por día</h2>
        <p className="mb-4 text-xs text-[hsl(var(--muted-foreground))]">Pasa el cursor por una barra para ver el detalle.</p>
        <DailyBars days={m.days} />
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-[hsl(var(--muted-foreground))]">Ver como tabla</summary>
          <div className="mt-2 max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[hsl(var(--muted-foreground))]">
                <tr><th className="py-1 font-medium">Día</th><th className="py-1 text-right font-medium">Pedidos</th><th className="py-1 text-right font-medium">Ventas</th></tr>
              </thead>
              <tbody>
                {m.days.map((d) => (
                  <tr key={d.day} className="border-t border-[hsl(var(--border))]">
                    <td className="py-1">{dayLabel.format(new Date(`${d.day}T12:00:00Z`))}</td>
                    <td className="py-1 text-right tabular-nums">{d.orders}</td>
                    <td className="py-1 text-right tabular-nums">{money(d.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-[hsl(var(--border))] p-5">
          <h2 className="mb-4 font-medium">Ventas por tipo de producto</h2>
          {m.byKind.length === 0 ? <Empty /> : (
            <BarList rows={m.byKind.map((k) => ({ label: k.label, value: k.revenue, detail: `${k.quantity} u.` }))} />
          )}
        </section>
        <section className="rounded-xl border border-[hsl(var(--border))] p-5">
          <h2 className="mb-4 font-medium">Productos más vendidos</h2>
          {m.topProducts.length === 0 ? <Empty /> : (
            <BarList rows={m.topProducts.map((p) => ({ label: p.name, value: p.revenue, detail: `${p.quantity} u.` }))} />
          )}
        </section>
      </div>

      <section className="mt-8">
        <h2 className="mb-1 text-lg font-semibold">Carritos abandonados</h2>
        <p className="mb-4 text-xs text-[hsl(var(--muted-foreground))]">
          Carritos creados en el mes. Recuperado = compró después del correo de recordatorio (hasta 14 días).
          {carts.converted > 0 && ` Otros ${carts.converted} compraron antes de necesitar el correo.`}
        </p>
        <Tiles tiles={cartTiles} />
      </section>
    </div>
  );
}

function Tiles({ tiles }: { tiles: { label: string; value: string; hint: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-xl border border-[hsl(var(--border))] p-4">
          <div className="text-xs text-[hsl(var(--muted-foreground))]">{t.label}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{t.value}</div>
          <div className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{t.hint}</div>
        </div>
      ))}
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-[hsl(var(--muted-foreground))]">Sin ventas en este mes.</p>;
}

/** Barras verticales de una sola serie; el tooltip nativo da el detalle por día. */
function DailyBars({ days }: { days: { day: string; orders: number; revenue: number }[] }) {
  const max = Math.max(...days.map((d) => d.revenue), 0);
  if (max === 0) return <Empty />;
  const width = 720;
  const height = 180;
  const slot = width / days.length;
  const bar = Math.max(2, slot - 2); // 2px de separación entre barras
  const r = Math.min(4, bar / 2);
  return (
    <svg viewBox={`0 0 ${width} ${height + 18}`} role="img" aria-label="Ventas por día del mes" className="h-auto w-full">
      <line x1="0" x2={width} y1={height} y2={height} stroke="hsl(var(--border))" strokeWidth="1" />
      {days.map((d, i) => {
        const h = d.revenue > 0 ? Math.max(r * 2, (d.revenue / max) * (height - 8)) : 0;
        const x = i * slot + (slot - bar) / 2;
        const y = height - h;
        const day = Number(d.day.slice(8));
        return (
          <g key={d.day} className="group">
            <title>{`${dayLabel.format(new Date(`${d.day}T12:00:00Z`))}: ${money(d.revenue)} · ${d.orders} pedido${d.orders === 1 ? '' : 's'}`}</title>
            {/* Zona de hover más grande que la barra. */}
            <rect x={i * slot} y="0" width={slot} height={height} fill="transparent" />
            {h > 0 && (
              <path
                d={`M${x},${height} V${y + r} Q${x},${y} ${x + r},${y} H${x + bar - r} Q${x + bar},${y} ${x + bar},${y + r} V${height} Z`}
                fill="hsl(var(--primary))"
                className="transition-opacity group-hover:opacity-70"
              />
            )}
            {(day === 1 || day % 5 === 0) && (
              <text x={i * slot + slot / 2} y={height + 14} textAnchor="middle" fontSize="11" fill="hsl(var(--muted-foreground))">
                {day}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function BarList({ rows }: { rows: { label: string; value: number; detail: string }[] }) {
  const max = Math.max(...rows.map((r) => r.value), 0) || 1;
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.label} className="text-sm">
          <div className="mb-1 flex justify-between gap-3">
            <span className="min-w-0 truncate">{row.label}</span>
            <span className="shrink-0 tabular-nums text-[hsl(var(--muted-foreground))]">
              {money(row.value)} · {row.detail}
            </span>
          </div>
          <div className="h-2 rounded-full bg-[hsl(var(--muted))]">
            <div className="h-2 rounded-full bg-[hsl(var(--primary))]" style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
