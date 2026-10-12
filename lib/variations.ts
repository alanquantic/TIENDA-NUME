import { slugify } from './slug';

/**
 * Variaciones por atributos (p. ej. Color × Talla).
 *
 * - La definición de atributos vive en `products.metadata.variationAttributes`
 *   (orden y etiquetas para mostrar).
 * - Cada variante guarda su combinación en `product_variants.attributes` como
 *   `{ [key]: valor }`, con `key` = nombre del atributo en minúsculas sin acentos
 *   (`Color` → `color`). Así se conserva el formato que ya usa la Agenda 2025
 *   (`{ color: 'morado' }`), del que depende la entrega de su PDF.
 */

export type VariationAttribute = {
  key: string;
  name: string;
  values: string[];
};

export const MAX_ATTRIBUTES = 3;
export const MAX_VARIANTS = 50;

export function attributeKey(name: string): string {
  return slugify(name).replace(/-/g, '_');
}

/** Lee la definición guardada en metadata, o la deduce de las variantes existentes. */
export function readVariationAttributes(
  metadata: unknown,
  variants: { attributes: unknown }[],
): VariationAttribute[] {
  const stored = (metadata as { variationAttributes?: unknown } | null)?.variationAttributes;
  if (Array.isArray(stored)) {
    const parsed = stored.filter(
      (a): a is VariationAttribute =>
        !!a &&
        typeof a.key === 'string' &&
        typeof a.name === 'string' &&
        Array.isArray(a.values),
    );
    if (parsed.length > 0) return parsed;
  }

  // Productos anteriores a esta función (Agenda 2025): se deduce de las variantes.
  const byKey = new Map<string, Set<string>>();
  for (const variant of variants) {
    const attrs = (variant.attributes ?? {}) as Record<string, unknown>;
    for (const [key, value] of Object.entries(attrs)) {
      if (typeof value !== 'string' || !value) continue;
      if (!byKey.has(key)) byKey.set(key, new Set());
      byKey.get(key)!.add(value);
    }
  }
  return [...byKey.entries()].map(([key, values]) => ({
    key,
    name: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
    values: [...values],
  }));
}

/** Todas las combinaciones posibles de valores (producto cartesiano). */
export function combinations(attributes: VariationAttribute[]): Record<string, string>[] {
  return attributes.reduce<Record<string, string>[]>(
    (acc, attribute) =>
      acc.flatMap((combo) => attribute.values.map((value) => ({ ...combo, [attribute.key]: value }))),
    [{}],
  );
}

/** Llave estable de una combinación, para comparar variantes. */
export function comboKey(attributes: VariationAttribute[], combo: Record<string, string>): string {
  return attributes.map((a) => `${a.key}=${(combo[a.key] ?? '').toLowerCase()}`).join('|');
}

/** Nombre por defecto de una variante: "Morado / M". */
export function comboLabel(attributes: VariationAttribute[], combo: Record<string, string>): string {
  return attributes.map((a) => combo[a.key]).filter(Boolean).join(' / ');
}
