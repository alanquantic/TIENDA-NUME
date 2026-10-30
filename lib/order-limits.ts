/**
 * Límite fijo de unidades por pedido para productos físicos (Agenda 2027,
 * libro…). Es una capa de seguridad en código, independiente de
 * `products.max_per_order`: aunque en el admin quede vacío o mayor, un
 * pedido nunca lleva más de esta cantidad de un mismo producto físico
 * (sumando todas sus variantes).
 */
export const PHYSICAL_MAX_PER_ORDER = 1;

/** Agenda Numerológica 2027 (física). Por ID: el slug se puede editar en el admin. */
export const AGENDA_2027_PRODUCT_ID = '1be11ac4-a5ef-4f05-88de-c13fafd99a91';

/** Físicos con un tope propio en lugar de PHYSICAL_MAX_PER_ORDER. */
export const PHYSICAL_MAX_PER_ORDER_BY_PRODUCT: Readonly<Record<string, number>> = {
  [AGENDA_2027_PRODUCT_ID]: 2,
};

/** Tope efectivo por pedido: el configurado en BD, acotado para físicos. */
export function effectiveMaxPerOrder(
  type: 'digital' | 'physical',
  configured: number | null | undefined,
  productId?: string | null,
): number | null {
  if (type !== 'physical') return configured ?? null;
  const cap = (productId && PHYSICAL_MAX_PER_ORDER_BY_PRODUCT[productId]) || PHYSICAL_MAX_PER_ORDER;
  return Math.min(configured ?? cap, cap);
}
