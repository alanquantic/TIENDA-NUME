import { z } from 'zod';

type SearchParams = Record<string, string | string[] | undefined>;

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  if (value.startsWith('0000-')) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseOrderFilters(params: SearchParams) {
  const productId = typeof params.producto === 'string' ? params.producto.trim() : '';
  const month = typeof params.mes === 'string' ? params.mes.trim() : '';
  let from = typeof params.desde === 'string' ? params.desde.trim() : '';
  let to = typeof params.hasta === 'string' ? params.hasta.trim() : '';
  const validMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && !month.startsWith('0000-');
  if (month && validMonth) {
    from = `${month}-01`;
    const lastDay = new Date(`${from}T12:00:00Z`);
    lastDay.setUTCMonth(lastDay.getUTCMonth() + 1, 0);
    to = lastDay.toISOString().slice(0, 10);
  }
  let error: string | null = null;
  if (productId && !z.string().uuid().safeParse(productId).success) error = 'Selecciona un producto válido.';
  else if (month && !validMonth) error = 'Selecciona un mes válido.';
  else if ((from && !validDate(from)) || (to && !validDate(to))) error = 'Selecciona fechas válidas.';
  else if (from && to && from > to) error = 'La fecha Desde debe ser anterior o igual a Hasta.';
  return { productId, from, to, month, error };
}
