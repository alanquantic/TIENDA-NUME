import { toMinor } from './money';

/**
 * Precio vigente de una variante. La oferta aplica solo si:
 *  - hay `salePriceAmount` y es MENOR que el precio regular, y
 *  - ahora está dentro de [saleStartsAt, saleEndsAt) (un extremo null = abierto).
 * Fuera de eso se cobra el precio regular. Lo usan el catálogo, el carrito y
 * `priceCart` (fuente de verdad del cobro), así que todos coinciden.
 */

export type SaleFields = {
  priceAmount: string;
  salePriceAmount: string | null;
  saleStartsAt: Date | string | null;
  saleEndsAt: Date | string | null;
};

export type EffectivePrice = {
  /** Lo que se cobra hoy. */
  priceAmount: string;
  /** Precio regular tachado; null si no hay oferta vigente. */
  regularPriceAmount: string | null;
  onSale: boolean;
  /** Fin de la oferta vigente (ISO), si tiene. */
  saleEndsAt: string | null;
};

function toDate(value: Date | string | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function effectivePrice(fields: SaleFields, now: Date = new Date()): EffectivePrice {
  const regular: EffectivePrice = {
    priceAmount: fields.priceAmount,
    regularPriceAmount: null,
    onSale: false,
    saleEndsAt: null,
  };
  if (fields.salePriceAmount == null || fields.salePriceAmount === '') return regular;
  if (toMinor(fields.salePriceAmount) >= toMinor(fields.priceAmount)) return regular;

  const startsAt = toDate(fields.saleStartsAt);
  const endsAt = toDate(fields.saleEndsAt);
  if (startsAt && now < startsAt) return regular;
  if (endsAt && now >= endsAt) return regular;

  return {
    priceAmount: fields.salePriceAmount,
    regularPriceAmount: fields.priceAmount,
    onSale: true,
    saleEndsAt: endsAt ? endsAt.toISOString() : null,
  };
}

/** Porcentaje de descuento redondeado (para la etiqueta "-20%"). */
export function discountPercent(price: EffectivePrice): number | null {
  if (!price.onSale || !price.regularPriceAmount) return null;
  const regular = toMinor(price.regularPriceAmount);
  if (regular <= 0) return null;
  return Math.round(((regular - toMinor(price.priceAmount)) / regular) * 100);
}
