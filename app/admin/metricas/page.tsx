import Link from 'next/link';
import { adminHref } from '@/lib/admin-path';
import { config } from '@/lib/config';
import { formatUsd } from '@/lib/admin/email-labels';
import { salesMetrics, getMetricsCurrencies } from '@/lib/admin/metrics';
import { parseMetricsFilters, STATUS_LABELS } from '@/lib/admin/sales-metrics';
import { SalesTrend } from '@/components/admin/sales-trend';
import { formatDecimal } from '@/lib/money';

export const dynamic = 'force-dynamic';

const dateLabel = new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeZone: 'UTC' });
const STATUS_COLORS = ['#a83279', '#29856b', '#5f68b5', '#c59139', '#c55c65', '#8b6c99'];
const KIND_NOTE = { real: 'Solo pedidos reales', test: 'Solo pedidos de prueba', all: 'Pedidos reales y de prueba' };
const fieldClass = 'mt-1.5 h-11 w-full min-w-0 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm';

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

function pct(part: number, total: number): string {
  return total === 0 ? '—' : `${Math.round((part / total) * 100)}%`;
}

export default async function AdminMetrics({ searchParams }: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = parseMetricsFilters(searchParams, config.currency);
  let m: Awaited<ReturnType<typeof salesMetrics>> | null = null;
  let currencies = [config.currency];
  let loadError = false;
  if (!filters.error) {
    try {
      const [result, options] = await Promise.all([
        salesMetrics(filters.from, filters.to, { currency: filters.currency, kind: filters.kind }),
        getMetricsCurrencies(),
      ]);
      m = result;
      currencies = [...new Set([config.currency, filters.currency, ...options.map((o) => o.currency)])];
    } catch (err) {
      console.error('[admin/metricas] no se pudieron cargar', err);
      loadError = true;
    }
  }
  const money = (value: number) => formatDecimal(value, filters.currency);
  const monthQuery = (month: string) =>
    adminHref(`/metricas?${new URLSearchParams({ mes: month, moneda: filters.currency, tipo: filters.kind })}`);
  const baseMonth = (filters.error ? new Date().toISOString() : filters.from).slice(0, 7);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Métricas</h1>
          {!filters.error && (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {dateLabel.format(new Date(`${filters.from}T12:00:00Z`))} – {dateLabel.format(new Date(`${filters.to}T12:00:00Z`))}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={monthQuery(shiftMonth(baseMonth, -1))} aria-label="Mes anterior" className="inline-flex h-11 items-center rounded-lg border border-[hsl(var(--border))] px-3 text-sm hover:bg-[hsl(var(--muted))]">←</Link>
          <Link href={adminHref('/metricas')} className="inline-flex h-11 items-center rounded-lg border border-[hsl(var(--border))] px-3 text-sm hover:bg-[hsl(var(--muted))]">Mes actual</Link>
          <Link href={monthQuery(shiftMonth(baseMonth, 1))} aria-label="Mes siguiente" className="inline-flex h-11 items-center rounded-lg border border-[hsl(var(--border))] px-3 text-sm hover:bg-[hsl(var(--muted))]">→</Link>
          <Link href={adminHref('/pedidos')} className="inline-flex h-11 items-center rounded-lg border border-[hsl(var(--border))] px-3 text-sm font-medium hover:bg-[hsl(var(--muted))]">Ver pedidos →</Link>
        </div>
      </div>

      <form action={adminHref('/metricas')} method="get" className="mb-6 grid gap-4 rounded-xl border border-[hsl(var(--border))] p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="min-w-0 text-sm font-medium">Desde<input name="desde" type="date" required defaultValue={filters.from} className={fieldClass} /></label>
        <label className="min-w-0 text-sm font-medium">Hasta<input name="hasta" type="date" required defaultValue={filters.to} className={fieldClass} /></label>
        <label className="min-w-0 text-sm font-medium">Moneda<select name="moneda" defaultValue={filters.currency} className={fieldClass}>{currencies.map((currency) => <option key={currency}>{currency}</option>)}</select></label>
        <label className="min-w-0 text-sm font-medium">Pedidos<select name="tipo" defaultValue={filters.kind} className={fieldClass}><option value="real">Reales</option><option value="test">De prueba</option><option value="all">Todos</option></select></label>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2 lg:col-span-4">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Fecha de creación del pedido · Ciudad de México · Hasta 366 días.</p>
          <button type="submit" className="h-11 rounded-lg bg-[hsl(var(--primary))] px-4 text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:opacity-90">Actualizar métricas</button>
        </div>
      </form>

      {(filters.error || loadError) && (
        <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">
          {filters.error ?? 'No pudimos cargar las métricas. Intenta actualizar de nuevo.'}
        </p>
      )}
      {m && <Report m={m} currency={filters.currency} kind={filters.kind} money={money} filtersKey={`${filters.from}-${filters.to}-${filters.currency}-${filters.kind}`} />}
    </div>
  );
}

function Report({ m, currency, kind, money, filtersKey }: {
  m: Awaited<ReturnType<typeof salesMetrics>>;
  currency: string;
  kind: keyof typeof KIND_NOTE;
  money: (value: number) => string;
  filtersKey: string;
}) {
  const tiles = [
    { label: 'Ventas', value: money(m.revenue), hint: `${m.orders} pedido${m.orders === 1 ? '' : 's'} pagado${m.orders === 1 ? '' : 's'}` },
    { label: 'Ticket promedio', value: m.orders ? money(m.averageTicket) : '—', hint: 'por pedido pagado' },
    { label: 'Descuentos', value: money(m.discounts), hint: 'cupones aplicados' },
    { label: 'Costo IA', value: formatUsd(m.ai.production), hint: `${m.ai.reports} reporte${m.ai.reports === 1 ? '' : 's'} · tokens ${formatUsd(m.ai.tokens)}` },
  ];
  const carts = m.carts;
  const cartMoney = (value: number) => formatDecimal(value, config.currency);
  const cartTiles = [
    { label: 'Carritos guardados', value: carts.saved.toLocaleString('es-MX'), hint: 'con correo en el checkout' },
    { label: 'Avisados', value: carts.notified.toLocaleString('es-MX'), hint: `${pct(carts.clicked, carts.notified)} abrió el enlace` },
    { label: 'Recuperados', value: carts.recovered.toLocaleString('es-MX'), hint: `${pct(carts.recovered, carts.notified)} de los avisados · ${cartMoney(carts.recoveredAmount)}` },
    { label: 'Sin comprar', value: carts.open.toLocaleString('es-MX'), hint: `${cartMoney(carts.openAmount)} en carritos abiertos` },
  ];
  const trend = m.days.map((d) => ({ day: d.day, orders: d.orders, revenue: Math.round(d.revenue * 100) }));

  const totalOrders = Object.values(m.statusCounts).reduce((sum, n) => sum + n, 0);
  const statusEntries = Object.entries(STATUS_LABELS).map(([key, label], i) => ({
    key, label, count: m.statusCounts[key] ?? 0, color: STATUS_COLORS[i],
  }));
  let accumulated = 0;
  const segments = statusEntries.map((entry) => {
    const start = accumulated;
    accumulated += totalOrders ? (entry.count / totalOrders) * 100 : 0;
    return `${entry.color} ${start}% ${accumulated}%`;
  });

  return (
    <>
      <p className="mb-4 text-xs text-[hsl(var(--muted-foreground))]">
        {KIND_NOTE[kind]}, pagados ({currency}, hora de Ciudad de México).
        {kind === 'real' && m.testOrders > 0 && ` Se excluyen ${m.testOrders} pedido${m.testOrders === 1 ? '' : 's'} de prueba.`}
      </p>

      <Tiles tiles={tiles} />

      <div className="mt-6">
        <SalesTrend key={filtersKey} points={trend} currency={currency} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-[hsl(var(--border))] p-5">
          <h2 className="font-medium">Estado de los pedidos</h2>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Todos los pedidos creados en el periodo, pagados o no.</p>
          <div className="my-6 flex justify-center">
            <div aria-hidden="true" className="flex h-40 w-40 items-center justify-center rounded-full" style={{ background: totalOrders ? `conic-gradient(${segments.join(',')})` : 'hsl(var(--muted))' }}>
              <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-[hsl(var(--background))]">
                <span className="text-2xl font-semibold">{totalOrders}</span>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">pedidos</span>
              </div>
            </div>
          </div>
          <ul className="space-y-3">
            {statusEntries.map((entry) => (
              <li key={entry.key} className="flex items-center gap-2 text-sm">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: entry.color }} />
                <span className="flex-1">{entry.label}</span>
                <strong>{entry.count}</strong>
                <span className="w-14 text-right text-xs text-[hsl(var(--muted-foreground))]">{pct(entry.count, totalOrders)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border border-[hsl(var(--border))] p-5">
          <h2 className="mb-4 font-medium">Productos más vendidos</h2>
          {m.topProducts.length === 0 ? <Empty /> : (
            <BarList money={money} rows={m.topProducts.map((p) => ({ label: p.name, value: p.revenue, detail: `${p.quantity} u.` }))} />
          )}
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-[hsl(var(--border))] p-5">
        <h2 className="mb-4 font-medium">Ventas por tipo de producto</h2>
        {m.byKind.length === 0 ? <Empty /> : (
          <BarList money={money} rows={m.byKind.map((k) => ({ label: k.label, value: k.revenue, detail: `${k.quantity} u.` }))} />
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-1 text-lg font-semibold">Carritos abandonados</h2>
        <p className="mb-4 text-xs text-[hsl(var(--muted-foreground))]">
          Carritos creados en el periodo, sin importar los filtros de moneda y tipo. Recuperado = compró después del correo de recordatorio (hasta 14 días).
          {carts.converted > 0 && ` Otros ${carts.converted} compraron antes de necesitar el correo.`}
        </p>
        <Tiles tiles={cartTiles} />
      </section>
    </>
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
  return <p className="text-sm text-[hsl(var(--muted-foreground))]">Sin ventas en este periodo.</p>;
}

function BarList({ rows, money }: { rows: { label: string; value: number; detail: string }[]; money: (value: number) => string }) {
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
