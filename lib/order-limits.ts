/**
 * Límite fijo de unidades por pedido para productos físicos (Agenda 2027,
 * libro…). Es una capa de seguridad en código, independiente de
 * `products.max_per_order`: aunque en el admin quede vacío o mayor, un
 * pedido nunca lleva más de esta cantidad de un mismo producto físico
 * (sumando todas sus variantes).
 */
export const PHYSICAL_MAX_PER_ORDER = 1;

/** Tope efectivo por pedido: el configurado en BD, acotado para físicos. */
export function effectiveMaxPerOrder(
  type: 'digital' | 'physical',
  configured: number | null | undefined,
): number | null {
  if (type !== 'physical') return configured ?? null;
  return Math.min(configured ?? PHYSICAL_MAX_PER_ORDER, PHYSICAL_MAX_PER_ORDER);
}
