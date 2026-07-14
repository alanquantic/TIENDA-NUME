/**
 * Todo el cálculo monetario se hace en la unidad mínima (centavos, enteros)
 * para evitar errores de coma flotante. Solo se convierte a decimal al
 * mostrar o al guardar en la columna `decimal` de la BD.
 */

/** "19.99" | 19.99 → 1999 (centavos). */
export function toMinor(amount: string | number): number {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

/** 1999 → "19.99" (para columnas decimal). */
export function fromMinorToDecimalString(minor: number): string {
  return (minor / 100).toFixed(2);
}

/** 1999 → 19.99 */
export function fromMinor(minor: number): number {
  return minor / 100;
}

/** Formatea para mostrar: 1999, "USD" → "$19.99" (según locale es-MX). */
export function formatMoney(
  amountMinor: number,
  currency = 'USD',
  locale = 'es-MX',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amountMinor / 100);
}

/** Formatea un valor decimal de BD ("19.99") para mostrar. */
export function formatDecimal(
  decimal: string | number,
  currency = 'USD',
  locale = 'es-MX',
): string {
  return formatMoney(toMinor(decimal), currency, locale);
}
