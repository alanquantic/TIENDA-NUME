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

export function parseOrderFilters(params: SearchParams) {
  const productId = typeof params.producto === 'string' ? params.producto.trim() : '';
  const from = typeof params.desde === 'string' ? params.desde.trim() : '';
  const to = typeof params.hasta === 'string' ? params.hasta.trim() : '';
  const { categoryId, error: categoryError } = parseCategoryFilter(params);
  let error: string | null = null;
  if (categoryError) error = categoryError;
  else if (productId && !z.string().uuid().safeParse(productId).success) error = 'Selecciona un producto válido.';
  else if ((from && !validDate(from)) || (to && !validDate(to))) error = 'Selecciona fechas válidas.';
  else if (from && to && from > to) error = 'La fecha Desde debe ser anterior o igual a Hasta.';
  return { productId, categoryId, from, to, error };
}
