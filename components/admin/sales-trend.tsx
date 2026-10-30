'use client';

import { useState } from 'react';
import { chartTrend, type TrendPoint } from '@/lib/admin/sales-metrics';
import { formatMoney } from '@/lib/money';

export function SalesTrend({ points, currency }: { points: TrendPoint[]; currency: string }) {
  const [metric, setMetric] = useState<'revenue' | 'orders'>('revenue');
  const [selected, setSelected] = useState<number | null>(null);
  const chart = chartTrend(points);
  const max = Math.max(1, ...chart.points.map(point => point[metric]));
  const activeIndex = Math.min(selected ?? chart.points.length - 1, chart.points.length - 1);
  const chosen = chart.points[activeIndex];
  const format = (value: number) => metric === 'revenue' ? formatMoney(value, currency) : value.toLocaleString('es-MX');
  const label = (day: string) => new Intl.DateTimeFormat('es-MX', {
    timeZone: 'UTC', month: 'short', ...(chart.monthly ? { year: 'numeric' } : { day: 'numeric' }),
  }).format(new Date(`${day}T12:00:00Z`));

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-semibold">Evolución de ventas y pedidos</h2><p className="mt-1 text-xs text-muted-foreground">{chart.monthly ? 'Agrupación mensual' : 'Agrupación diaria'} · Ciudad de México</p></div>
        <div className="flex rounded-lg bg-muted p-1">
          {(['revenue', 'orders'] as const).map(value => <button key={value} type="button" aria-pressed={metric === value}
            onClick={() => setMetric(value)} className={`rounded-md px-3 py-2 text-xs font-semibold ${metric === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
            {value === 'revenue' ? 'Ventas brutas' : 'Pedidos'}
          </button>)}
        </div>
      </div>
      <div className="mt-5 rounded-lg bg-muted p-3 text-sm text-muted-foreground" role="status" aria-live="polite" aria-atomic="true">
        {chosen ? <>
          <p className="font-semibold capitalize text-foreground">{label(chosen.day)}</p>
          <p className="mt-1">Ventas brutas: <strong className="text-foreground">{formatMoney(chosen.revenue, currency)} {currency}</strong></p>
          <p>Pedidos: <strong className="text-foreground">{chosen.orders.toLocaleString('es-MX')}</strong></p>
        </> : 'Sin datos'}
      </div>
      <div className="mt-4 flex gap-3">
        <div className="flex h-52 shrink-0 flex-col justify-between text-[10px] text-muted-foreground"><span>{format(max)}</span><span>{format(Math.round(max / 2))}</span><span>0</span></div>
        <div className="min-w-0 flex-1 overflow-x-auto pb-2">
          <div className="flex h-52 items-end gap-1 border-b border-border bg-[linear-gradient(to_top,transparent_49.5%,hsl(var(--border))_50%,transparent_50.5%)]" style={{ minWidth: chart.points.length * 28 }}>
            {chart.points.map((point, index) => <button type="button" key={point.day}
              aria-label={`${label(point.day)}: ventas brutas ${formatMoney(point.revenue, currency)} ${currency}, ${point.orders} pedidos`}
              aria-pressed={activeIndex === index}
              onFocus={() => setSelected(index)} onPointerEnter={() => setSelected(index)}
              onPointerDown={() => setSelected(index)} onClick={() => setSelected(index)}
              className={`flex h-full min-w-6 flex-1 items-end rounded-t focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${activeIndex === index ? 'bg-primary/10' : 'hover:bg-primary/5'}`}
            >
              <span aria-hidden="true" className={`pointer-events-none block w-full rounded-t transition-opacity ${point[metric] ? 'bg-primary' : 'bg-border'} ${activeIndex === index ? 'opacity-100' : 'opacity-70'}`}
                style={{ height: `${Math.max(point[metric] ? 2 : 1, point[metric] / max * 100)}%` }} />
            </button>)}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground"><span>{chart.points[0] && label(chart.points[0].day)}</span><span>{chart.points.at(-1) && label(chart.points.at(-1)!.day)}</span></div>
        </div>
      </div>
      <details className="mt-4 text-xs text-muted-foreground">
        <summary className="cursor-pointer">Ver datos del gráfico</summary>
        <div className="mt-3 max-h-60 overflow-auto"><table className="w-full text-left"><thead><tr><th className="py-2">Periodo</th><th>Pedidos</th><th>Ventas brutas ({currency})</th></tr></thead>
          <tbody>{chart.points.map(point => <tr key={point.day} className="border-t border-border"><td className="py-2">{label(point.day)}</td><td>{point.orders}</td><td>{formatMoney(point.revenue, currency)}</td></tr>)}</tbody>
        </table></div>
      </details>
    </section>
  );
}
