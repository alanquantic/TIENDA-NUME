import type { AdminProductInput } from './validation';

/** Columnas de oferta de la variante a partir del formulario del admin. */
export function saleColumns(d: AdminProductInput) {
  return {
    salePriceAmount: d.salePrice ? d.salePrice : null,
    saleStartsAt: d.saleStartsAt ? new Date(d.saleStartsAt) : null,
    saleEndsAt: d.saleEndsAt ? new Date(d.saleEndsAt) : null,
  };
}

/**
 * Inventario de la variante. En físicos, un stock vacío significa "sin control
 * de inventario" (siempre disponible); con número, se descuenta y puede agotarse.
 * Los digitales nunca llevan inventario.
 */
export function inventoryColumns(d: AdminProductInput) {
  const tracked = d.type === 'physical' && d.stock != null;
  return {
    stock: tracked ? (d.stock as number) : 0,
    trackInventory: tracked,
  };
}
