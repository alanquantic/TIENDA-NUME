// Planes Numerathum (Espejo, Horizonte 60, Oráculo 365). Son productos
// digitales normales, editables en el admin: cada plan es un producto de la
// categoría `planes-numerathum` y cada vigencia (Mensual / Anual) es una
// variante con el atributo `vigencia`. Sin dependencias server-only: lo usan
// la entrega, el script de alta y la UI.

import type { ProductDuration } from './product-groups';

/** Toda la categoría se entrega como Numerathum (aviso externo incluido). */
export const NUMERATHUM_PLANS_CATEGORY_SLUG = 'planes-numerathum';
export const NUMERATHUM_PLANS_CATEGORY_NAME = 'Planes Numerathum';

/** Atributo de variación que define la vigencia. */
export const PLAN_PERIOD_ATTRIBUTE = 'vigencia';

export type PlanPeriod = 'monthly' | 'annual';

export const PLAN_PERIOD_DURATION: Record<PlanPeriod, ProductDuration> = {
  monthly: { value: 1, unit: 'month' },
  annual: { value: 12, unit: 'month' },
};

const normalize = (value: string) =>
  value.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();

/** Vigencia de una variante por su valor/nombre ("Mensual", "Anual"…), o null. */
export function planPeriod(value: string | null | undefined): PlanPeriod | null {
  if (!value) return null;
  const v = normalize(value);
  if (v.includes('anual') || v.includes('12 meses') || v.includes('1 ano')) return 'annual';
  if (v.includes('mensual') || v.includes('1 mes') || v === 'mes') return 'monthly';
  return null;
}

/** Definición de los planes para darlos de alta (los precios luego se editan en el admin). */
export const NUMERATHUM_PLANS = [
  {
    slug: 'numerathum-espejo',
    name: 'Numerathum Espejo',
    planCode: 'numerathum-espejo',
    image: '/images/numerathum/espejo.svg',
    prices: { monthly: '149.00', annual: '1099.00' },
  },
  {
    slug: 'numerathum-horizonte-60',
    name: 'Numerathum Horizonte 60',
    planCode: 'numerathum-horizonte-60',
    image: '/images/numerathum/horizonte-60.svg',
    prices: { monthly: '189.00', annual: '1599.00' },
  },
  {
    slug: 'numerathum-oraculo-365',
    name: 'Numerathum Oráculo 365',
    // Mismo código que el Oráculo 365 que ya se vendía: es el mismo acceso.
    planCode: 'numerathum-oraculo-365',
    image: '/images/numerathum/oraculo-365.svg',
    // Exclusivamente anual.
    prices: { monthly: null, annual: '1899.00' },
  },
] as const;

/** Símbolo decorativo de cada plan en /planes. */
export function planSymbol(slug: string): string {
  if (slug.includes('espejo')) return '◒';
  if (slug.includes('horizonte')) return '☼';
  return '✧';
}
