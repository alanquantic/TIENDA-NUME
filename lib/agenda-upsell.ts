/**
 * Aviso "¿Prefieres la agenda 2027?" al agregar al carrito una agenda anterior.
 *
 * Aplica a los productos de la categoría Agenda Numerológica que NO son de la
 * colección 2027 (agendas y planeadores 2025/2026, Kit Primavera…). El destino
 * es el producto 2027 de esa categoría; si no hay ninguno activo, no se avisa.
 */

export const AGENDA_CATEGORY_SLUG = 'agenda-numerologica';
export const CURRENT_YEAR_MATCH = /2027/;

export type UpsellTarget = { href: string; name: string };

export function isPreviousAgenda(slug: string, categorySlug: string | null | undefined): boolean {
  return categorySlug === AGENDA_CATEGORY_SLUG && !CURRENT_YEAR_MATCH.test(slug);
}
