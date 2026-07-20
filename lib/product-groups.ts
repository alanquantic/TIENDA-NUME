// Clasificación de productos que necesitan trato especial tras la compra
// (nota en el correo y/o aviso a un sistema externo). Sin dependencias
// server-only: lo pueden usar tanto el fulfillment como la UI.

export type ProductGroup =
  | 'membership'
  | 'license'
  | 'certification'
  | 'numerathum'
  | 'kit-primavera'
  | 'agenda-fisica-2026';

export const MEMBERSHIP_SLUGS = ['membresia-180', 'membresia-360'] as const;

export const LICENSE_SLUGS = [
  'licencia-software-arithmax-1-ano',
  'licencia-software-arithmax-3-anos',
] as const;

export const NUMERATHUM_SLUG = 'numerathum-oraculo-365-agenda-numerologica-2026-digital-pdf';
export const KIT_PRIMAVERA_SLUG = 'kit-primavera';
export const AGENDA_FISICA_2026_SLUG = 'agenda-numerologica-2026-fisica';

/** Las certificaciones se identifican por CATEGORÍA (la lista puede crecer). */
export const CERTIFICATION_CATEGORY_SLUG = 'certificaciones';

/** Grupo de un producto, o null si es un producto normal. */
export function groupForProduct(slug: string, categorySlug?: string | null): ProductGroup | null {
  if ((MEMBERSHIP_SLUGS as readonly string[]).includes(slug)) return 'membership';
  if ((LICENSE_SLUGS as readonly string[]).includes(slug)) return 'license';
  if (slug === NUMERATHUM_SLUG) return 'numerathum';
  if (slug === KIT_PRIMAVERA_SLUG) return 'kit-primavera';
  if (slug === AGENDA_FISICA_2026_SLUG) return 'agenda-fisica-2026';
  if (categorySlug === CERTIFICATION_CATEGORY_SLUG) return 'certification';
  return null;
}

/**
 * Nota que se agrega al correo de confirmación por grupo.
 * null = ese grupo no lleva nota (sus entregables son los reportes/links).
 */
export const GROUP_EMAIL_NOTE: Record<ProductGroup, string | null> = {
  membership:
    'Sobre tu membresía: si la estás renovando, el cambio ya está aplicado en tu cuenta de Numerología Cotidiana. Si es tu primera membresía, te llegará otro correo con tus accesos.',
  license:
    'Sobre tu licencia: en breve recibirás un correo con tus accesos al software Arithmax, o la confirmación de que tu licencia fue renovada.',
  certification:
    'Sobre tu certificación: ¡gracias por inscribirte! En unos momentos te contactamos para darte tus accesos.',
  numerathum: null,
  'kit-primavera': null,
  'agenda-fisica-2026': null,
};

/** Grupos que avisan a un sistema externo al comprarse (las certificaciones no). */
export type ExternalHookGroup = Exclude<ProductGroup, 'certification'>;

export const GROUPS_WITH_EXTERNAL_HOOK: ExternalHookGroup[] = [
  'membership',
  'license',
  'numerathum',
  'kit-primavera',
  'agenda-fisica-2026',
];

export function hasExternalHook(group: ProductGroup): group is ExternalHookGroup {
  return (GROUPS_WITH_EXTERNAL_HOOK as ProductGroup[]).includes(group);
}

// ───────────────────────────────────────────────────────────────
// Vigencia (duración del acceso que otorga cada producto)
// ───────────────────────────────────────────────────────────────

export type DurationUnit = 'day' | 'month' | 'year';
export type ProductDuration = { value: number; unit: DurationUnit };

export type ProductAccessConfig = {
  /** Código estable del plan, para mapear del lado receptor. */
  planCode: string;
  duration: ProductDuration;
};

/**
 * Cuánto dura el acceso que da cada producto. Confirmado con el cliente
 * el 2026-07-16: la Membresía 180 son 6 MESES y la 360 son 12 MESES
 * (el número del nombre es comercial, no días).
 */
export const PRODUCT_ACCESS: Record<string, ProductAccessConfig> = {
  'membresia-180': { planCode: 'membresia-180', duration: { value: 6, unit: 'month' } },
  'membresia-360': { planCode: 'membresia-360', duration: { value: 12, unit: 'month' } },
  'licencia-software-arithmax-1-ano': {
    planCode: 'arithmax-1-ano',
    duration: { value: 1, unit: 'year' },
  },
  'licencia-software-arithmax-3-anos': {
    planCode: 'arithmax-3-anos',
    duration: { value: 3, unit: 'year' },
  },
  'kit-primavera': { planCode: 'kit-primavera', duration: { value: 1, unit: 'month' } },
  [NUMERATHUM_SLUG]: {
    planCode: 'numerathum-oraculo-365',
    duration: { value: 1, unit: 'year' },
  },
};

/** Vigencia del producto, o null si no otorga un acceso con caducidad. */
export function accessForProduct(slug: string | null): ProductAccessConfig | null {
  return slug ? (PRODUCT_ACCESS[slug] ?? null) : null;
}
