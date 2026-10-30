import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/admin-auth';
import { config } from '@/lib/config';
import { formatMoney } from '@/lib/money';
import { parseMetricsFilters, summarizeMetrics, STATUS_LABELS } from '@/lib/admin/sales-metrics';
import { getMetricsCurrencies, getSalesMetrics } from '@/lib/admin/sales-metrics-query';
import { SalesTrend } from '@/components/admin/sales-trend';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Métricas | Admin' };
const COLORS = ['#a83279', '#29856b', '#5f68b5', '#c59139', '#c55c65', '#8b6c99'];
const inputClass = 'mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm';

export default async function AdminMetrics({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  if (!await isAdminAuthed()) redirect('/admin/login');
  const filters = parseMetricsFilters(searchParams, config.currency);
  let data: Awaited<ReturnType<typeof getSalesMetrics>> | null = null;
  let currencies = [config.currency];
  let loadError = false;
  if (!filters.error) {
    try {
      const [result, options] = await Promise.all([getSalesMetrics(filters), getMetricsCurrencies()]);
      data = result;
      currencies = [...new Set([config.currency, filters.currency, ...options.map(option => option.currency)])];
    } catch { loadError = true; }
  }
  const summary = data ? summarizeMetrics(data.daily, filters.from, filters.to) : null;
  const statusEntries = summary ? Object.entries(STATUS_LABELS).map(([key, label], i) => ({ key, label, count: summary.counts[key] ?? 0, color: COLORS[i] })) : [];
  let accumulated = 0;
  const segments = statusEntries.map(entry => {
    const start = accumulated;
    accumulated += summary?.totalOrders ? entry.count / summary.totalOrders * 100 : 0;
    return `${entry.color} ${start}% ${accumulated}%`;
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-primary">Actividad de la tienda</p><h1 className="mt-2 text-3xl font-semibold">Métricas</h1><p className="mt-2 text-sm text-muted-foreground">Ventas y pedidos, en un solo lugar.</p></div>
        <Link href="/admin/pedidos" className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Ver pedidos →</Link>
      </header>

      <form action="/admin/metricas" method="get" className="grid gap-4 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-medium">Desde<input name="desde" type="date" required defaultValue={filters.from} className={inputClass} /></label>
        <label className="text-sm font-medium">Hasta<input name="hasta" type="date" required defaultValue={filters.to} className={inputClass} /></label>
        <label className="text-sm font-medium">Moneda<select name="moneda" defaultValue={filters.currency} className={inputClass}>{currencies.map(currency => <option key={currency}>{currency}</option>)}</select></label>
        <label className="text-sm font-medium">Pedidos<select name="tipo" defaultValue={filters.kind} className={inputClass}><option value="real">Reales</option><option value="test">De prueba</option><option value="all">Todos</option></select></label>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2 lg:col-span-4">
          <p className="text-xs text-muted-foreground">Fecha de creación · Ciudad de México · Hasta 366 días</p>
          <div className="flex items-center gap-3"><Link href="/admin/metricas" className="text-sm text-muted-foreground underline">Mes actual</Link><button className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">Actualizar métricas</button></div>
        </div>
      </form>

      {filters.error || loadError ? <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 p-5 text-sm text-red-600">{filters.error ?? 'No pudimos cargar las métricas. Intenta actualizar de nuevo.'}</p> : null}
      {summary && data ? <>
        {!summary.totalOrders ? <p className="rounded-xl border border-border bg-muted p-4 text-sm">No hay pedidos con estos filtros. Selecciona otro periodo o tipo de pedido.</p> : null}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: `Ventas brutas · ${filters.currency}`, value: formatMoney(summary.grossMinor, filters.currency), detail: 'Pedidos pagados con valor comercial' },
            { label: 'Pedidos', value: summary.totalOrders.toLocaleString('es-MX'), detail: `${summary.paidOrders} pagados · ${summary.paidRate.toFixed(1)}% del total` },
            { label: 'Ticket promedio', value: formatMoney(summary.averageMinor, filters.currency), detail: 'Ventas brutas / pedidos con valor comercial' },
            { label: 'Pendientes de pago', value: (summary.counts.pending ?? 0).toLocaleString('es-MX'), detail: `${summary.refundedOrders} con reembolso total o parcial` },
          ].map((card, i) => <section key={card.label} className={`rounded-2xl border p-5 ${i === 0 ? 'border-primary/20 bg-primary/5' : 'border-border bg-card'}`}>
            <h2 className="text-xs font-medium text-muted-foreground">{card.label}</h2><p className="mt-3 break-words text-2xl font-semibold tracking-tight">{card.value}</p><p className="mt-2 text-xs text-muted-foreground">{card.detail}</p>
          </section>)}
        </div>

        <SalesTrend key={`${filters.from}-${filters.to}-${filters.currency}-${filters.kind}`} points={summary.trend} currency={filters.currency} />

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h2 className="font-semibold">Estado de los pedidos</h2>
            <div className="my-6 flex justify-center"><div aria-hidden="true" className="flex h-40 w-40 items-center justify-center rounded-full" style={{ background: summary.totalOrders ? `conic-gradient(${segments.join(',')})` : 'hsl(var(--muted))' }}>
              <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-card"><span className="text-2xl font-semibold">{summary.totalOrders}</span><span className="text-xs text-muted-foreground">pedidos</span></div>
            </div></div>
            <ul className="space-y-3">{statusEntries.map(entry => <li key={entry.key} className="flex items-center gap-2 text-sm"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: entry.color }} /><span className="flex-1">{entry.label}</span><strong>{entry.count}</strong><span className="w-14 text-right text-xs text-muted-foreground">{summary.totalOrders ? (entry.count / summary.totalOrders * 100).toFixed(1) : '0'}%</span></li>)}</ul>
          </section>
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h2 className="font-semibold">Productos más vendidos</h2><p className="mt-1 text-xs text-muted-foreground">Unidades con valor comercial · Top 8</p>
            {data.topProducts.length ? <ol className="mt-6 space-y-5">{data.topProducts.map((product, i) => <li key={`${product.name}-${i}`}>
              <div className="mb-2 flex items-start gap-3 text-sm"><span className="text-muted-foreground">{i + 1}.</span><span className="min-w-0 flex-1 font-medium">{product.name}</span><span className="shrink-0 text-right font-semibold">{product.units}<span className="block text-[10px] font-normal text-muted-foreground">{product.orders} pedidos</span></span></div>
              <div aria-hidden="true" className="h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${product.units / Math.max(1, data.topProducts[0].units) * 100}%` }} /></div>
            </li>)}</ol> : <p className="mt-8 text-sm text-muted-foreground">No hay productos vendidos en este periodo.</p>}
          </section>
        </div>

        <details className="rounded-xl border border-border p-4 text-xs leading-6 text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">Cómo se calculan estas métricas</summary>
          <p className="mt-2">El periodo corresponde a la creación del pedido, no a la fecha del pago. Las ventas brutas incluyen impuestos y envío de pedidos pagados, entregados y reembolsados; no descuentan reembolsos. Las unidades vendidas tampoco descuentan devoluciones. Ventas, ticket promedio y productos vendidos excluyen operaciones de prueba, pedidos con total cero o negativo y pedidos cuyo descuento cubre todo el subtotal. Las unidades vendidas también excluyen artículos gratuitos. El ticket promedio usa únicamente pedidos con valor comercial.</p>
          <p>Los porcentajes de pago representan pedidos pagados sobre pedidos creados; no son una tasa de conversión de visitas. Cada moneda se consulta por separado. Los conteos generales conservan los pedidos gratuitos; al seleccionar pruebas, las ventas comerciales y los productos vendidos serán cero.</p>
          <p>Se consideran pruebas los pagos sandbox, los pagos simulados y los pedidos con un cupón que contiene “test” o “prueba” y cubre el 100% del subtotal. Los pedidos sin esas marcas se consideran reales.</p>
        </details>
      </> : null}
    </div>
  );
}
