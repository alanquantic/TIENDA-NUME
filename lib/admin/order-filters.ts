import { z } from 'zod';

type SearchParams = Record<string, string | string[] | undefined>;

/** Valor del filtro de categoría para los productos sin categoría. */
export const NO_CATEGORY = 'sin';

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  if (value.startsWith('0000-')) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validCategory(value: string): boolean {
  return value === NO_CATEGORY || z.string().uuid().safeParse(value).success;
}

/** `?categoria=` de las listas del admin: id de categoría, "sin" o vacío. */
export function parseCategoryFilter(params: SearchParams) {
  const categoryId = typeof params.categoria === 'string' ? params.categoria.trim() : '';
  const error = categoryId && !validCategory(categoryId) ? 'Selecciona una categoría válida.' : null;
  return { categoryId, error };
}

/** `?tipo=`: pedidos reales, de prueba o todos (vacío). */
export type OrderKindFilter = '' | 'reales' | 'pruebas';

/** Primer y último día (YYYY-MM-DD) de un mes `YYYY-MM`, o null si no es válido. */
export function monthRange(month: string): { from: string; to: string } | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month.startsWith('0000-')) return null;
  const [year, mm] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, mm, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` };
}

export function parseOrderFilters(params: SearchParams) {
  const productId = typeof params.producto === 'string' ? params.producto.trim() : '';
  const month = typeof params.mes === 'string' ? params.mes.trim() : '';
  let from = typeof params.desde === 'string' ? params.desde.trim() : '';
  let to = typeof params.hasta === 'string' ? params.hasta.trim() : '';
  const rawKind = typeof params.tipo === 'string' ? params.tipo.trim() : '';
  const kind: OrderKindFilter = rawKind === 'reales' || rawKind === 'pruebas' ? rawKind : '';
  const { categoryId, error: categoryError } = parseCategoryFilter(params);
  const range = month ? monthRange(month) : null;
  // El mes manda sobre Desde/Hasta: es el atajo para ver un mes completo.
  if (range) ({ from, to } = range);
  let error: string | null = null;
  if (categoryError) error = categoryError;
  else if (productId && !z.string().uuid().safeParse(productId).success) error = 'Selecciona un producto válido.';
  else if (month && !range) error = 'Selecciona un mes válido.';
  else if (rawKind && !kind) error = 'Selecciona un tipo de pedido válido.';
  else if ((from && !validDate(from)) || (to && !validDate(to))) error = 'Selecciona fechas válidas.';
  else if (from && to && from > to) error = 'La fecha Desde debe ser anterior o igual a Hasta.';
  return { productId, categoryId, month: range ? month : '', from, to, kind, error };
}

export type OrderFilters = ReturnType<typeof parseOrderFilters>;

/** Los filtros como query string (para el CSV y los enlaces). */
export function orderFiltersQuery(filters: OrderFilters): string {
  const qs = new URLSearchParams();
  if (filters.categoryId) qs.set('categoria', filters.categoryId);
  if (filters.productId) qs.set('producto', filters.productId);
  if (filters.month) qs.set('mes', filters.month);
  else {
    if (filters.from) qs.set('desde', filters.from);
    if (filters.to) qs.set('hasta', filters.to);
  }
  if (filters.kind) qs.set('tipo', filters.kind);
  return qs.toString();
}
