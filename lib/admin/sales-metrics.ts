import { parseOrderFilters } from './order-filters';

export const METRICS_TIME_ZONE = 'America/Mexico_City';
export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendientes', paid: 'Pagados', fulfilled: 'Entregados', cancelled: 'Cancelados',
  refunded: 'Reembolsados', partially_refunded: 'Reembolso parcial',
};

export type MetricsKind = 'real' | 'test' | 'all';

export function parseMetricsFilters(params: Record<string, string | string[] | undefined>, currency: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: METRICS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (key: string) => parts.find(p => p.type === key)!.value;
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  const dateFilters = parseOrderFilters({
    mes: params.mes, desde: params.desde ?? `${today.slice(0, 7)}-01`, hasta: params.hasta ?? today,
  });
  const selectedCurrency = typeof params.moneda === 'string' ? params.moneda.toUpperCase() : currency;
  const kind = typeof params.tipo === 'string' ? params.tipo : 'real';
  let error = dateFilters.error;
  if (Object.values(params).some(value => Array.isArray(value))) error = 'Selecciona un solo valor por filtro.';
  else if (!dateFilters.from || !dateFilters.to) error = 'Selecciona las fechas Desde y Hasta.';
  else if (!/^[A-Z]{3}$/.test(selectedCurrency)) error = 'Selecciona una moneda válida.';
  else if (!['real', 'test', 'all'].includes(kind)) error = 'Selecciona un tipo de pedido válido.';
  else if (!error && (Date.parse(dateFilters.to) - Date.parse(dateFilters.from)) / 86400000 > 365) error = 'Selecciona un periodo de hasta 366 días.';
  return { from: dateFilters.from, to: dateFilters.to, currency: selectedCurrency, kind: kind as MetricsKind, error };
}

export type TrendPoint = { day: string; orders: number; revenue: number };

export function chartTrend(points: TrendPoint[]): { monthly: boolean; points: TrendPoint[] } {
  if (points.length <= 62) return { monthly: false, points };
  const months = new Map<string, TrendPoint>();
  for (const point of points) {
    const key = point.day.slice(0, 7);
    const group = months.get(key) ?? { day: `${key}-01`, orders: 0, revenue: 0 };
    group.orders += point.orders;
    group.revenue += point.revenue;
    months.set(key, group);
  }
  return { monthly: true, points: [...months.values()] };
}
