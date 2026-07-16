// Mapeo producto (slug) → reportes del generador. Sin dependencias server-only:
// también lo usa el checkout (cliente) para saber qué datos pedir.
//
// El catálogo en vivo del generador está en GET <REPORT_GENERATOR_URL>/reports.
// Hay dos clases de reporte:
//   - 'generated': se arma con los datos de la persona (y pareja si aplica).
//   - 'static':    PDF pre-hecho; NO se envía person/partner. Algunos tienen
//                  versiones (color) y requieren el campo `variant`.
//
// Un producto puede entregar VARIOS reportes (membresías, kits, bundles). Todos
// los reportes de un mismo producto se generan con los mismos datos de persona.

export type ReportKey =
  // ── Generados (necesitan datos de la persona) ──
  | 'reporte-quien-soy'
  | 'reporte-quien-soy-extended'
  | 'reporte-etapa-de-vida-2022'
  | 'reporte-etapa-de-vida-2023'
  | 'reporte-etapa-de-vida-2026'
  | 'horoscopo'
  | 'amor-pareja-ano-personal'
  | 'reporte-pareja'
  | 'reporte-pareja-2025'
  | 'reporte-pareja-2023'
  | 'bonus-pareja'
  | 'reporte-maestro'
  | 'reporte-herida'
  | 'reporte-antidoto'
  | 'reporte-personalidad-pareja'
  | 'reporte-lectura-pareja'
  // "Año Personal de la Pareja 2026" (requiere pareja). Confirmado en el
  // catálogo en vivo del generador el 2026-07-15.
  | 'nuestra-leccion'
  // ── Estáticos (PDF pre-hecho; NO llevan person/partner) ──
  | 'reporte-semestral'
  | 'agenda-numerologica-2026'
  | 'planeador-numerologico-2026'
  | 'agenda-numerologica-2025';

/** Colores (versiones) del estático `agenda-numerologica-2025`. */
export type Agenda2025Color = 'azul' | 'verde' | 'naranja' | 'morado';
export const AGENDA_2025_COLORS: Agenda2025Color[] = ['azul', 'verde', 'naranja', 'morado'];

export type ReportMapping = {
  report: ReportKey;
  /** 'generated' pide datos de la persona; 'static' es un PDF pre-hecho. */
  kind: 'generated' | 'static';
  /** Solo 'generated': además necesita datos de la pareja. */
  needsPartner: boolean;
  /** Solo 'static' con versiones (agenda 2025): requiere `variant` (color). */
  needsVariant?: boolean;
  /** Etiqueta corta para mostrar en el checkout. */
  label: string;
};

const QUIEN_SOY: ReportMapping = {
  report: 'reporte-quien-soy',
  kind: 'generated',
  needsPartner: false,
  label: '¿Quién soy?',
};

/**
 * Producto en la tienda (SLUG) → reportes a generar.
 * Claves validadas contra el catálogo en vivo del generador (`GET /reports`).
 */
export const PRODUCT_TO_REPORTS: Record<string, ReportMapping[]> = {
  // ── Reportes individuales (generados) ──
  'reporte-quien-soy': [QUIEN_SOY],
  'reporte-quien-soy-version-extendida': [
    {
      report: 'reporte-quien-soy-extended',
      kind: 'generated',
      needsPartner: false,
      label: '¿Quién soy? extendido',
    },
  ],
  'reporte-etapa-de-vida-2026': [
    {
      report: 'reporte-etapa-de-vida-2026',
      kind: 'generated',
      needsPartner: false,
      label: 'Etapa de Vida 2026',
    },
  ],
  'reporte-el-amor-segun-tu-ano-personal': [
    {
      report: 'amor-pareja-ano-personal',
      kind: 'generated',
      needsPartner: false,
      label: 'El Amor Según tu Año Personal',
    },
  ],
  // Clave propia; NO choca con reporte-pareja ("Numerología de Pareja").
  'reporte-ano-personal-de-la-pareja-2026': [
    {
      report: 'nuestra-leccion',
      kind: 'generated',
      needsPartner: true,
      label: 'Año Personal de la Pareja 2026',
    },
  ],
  'reporte-numerologia-de-pareja': [
    { report: 'reporte-pareja', kind: 'generated', needsPartner: true, label: 'Numerología de Pareja' },
  ],
  'reporte-nuestra-personalidad-de-pareja': [
    {
      report: 'reporte-personalidad-pareja',
      kind: 'generated',
      needsPartner: true,
      label: 'Nuestra personalidad de pareja',
    },
  ],
  'reporte-nuestro-antidoto-de-pareja': [
    { report: 'reporte-antidoto', kind: 'generated', needsPartner: true, label: 'Nuestro Antídoto de Pareja' },
  ],
  'reporte-la-herida-que-sano-con-mi-pareja': [
    { report: 'reporte-herida', kind: 'generated', needsPartner: true, label: 'La herida que sano con mi pareja' },
  ],
  'reporte-quien-es-mi-maestro': [
    { report: 'reporte-maestro', kind: 'generated', needsPartner: true, label: '¿Quién es mi maestro?' },
  ],

  // ── Estáticos (PDF pre-hecho) ──
  'reporte-semestral-2026': [
    { report: 'reporte-semestral', kind: 'static', needsPartner: false, label: 'Reporte Semestral 2026' },
  ],
  'agenda-numerologica-2026-digital-pdf': [
    { report: 'agenda-numerologica-2026', kind: 'static', needsPartner: false, label: 'Agenda Numerológica 2026' },
  ],
  'planeador-numerologico-2026-digital-pdf': [
    {
      report: 'planeador-numerologico-2026',
      kind: 'static',
      needsPartner: false,
      label: 'Planeador Numerológico 2026',
    },
  ],
  // Estático con versiones (color) → requiere `variant`.
  'agenda-numerologica-2025-digital-pdf': [
    {
      report: 'agenda-numerologica-2025',
      kind: 'static',
      needsPartner: false,
      needsVariant: true,
      label: 'Agenda Numerológica 2025',
    },
  ],

  // ── Bundles: un producto entrega VARIOS reportes ──
  // Numerathum incluye el PDF de la Agenda 2026 (va como link en el correo).
  'numerathum-oraculo-365-agenda-numerologica-2026-digital-pdf': [
    { report: 'agenda-numerologica-2026', kind: 'static', needsPartner: false, label: 'Agenda Numerológica 2026' },
  ],
  'kit-primavera': [
    {
      report: 'reporte-etapa-de-vida-2026',
      kind: 'generated',
      needsPartner: false,
      label: 'Etapa de Vida 2026',
    },
    QUIEN_SOY,
    { report: 'reporte-lectura-pareja', kind: 'generated', needsPartner: true, label: 'Lectura de Pareja' },
  ],
};

/** Membresías: entregan los mismos 3 reportes. */
const MEMBRESIA_REPORTS: ReportMapping[] = [
  { report: 'nuestra-leccion', kind: 'generated', needsPartner: true, label: 'Año Personal de la Pareja' },
  QUIEN_SOY,
  { report: 'horoscopo', kind: 'generated', needsPartner: false, label: 'Horóscopo' },
];
PRODUCT_TO_REPORTS['membresia-360'] = MEMBRESIA_REPORTS;
PRODUCT_TO_REPORTS['membresia-180'] = MEMBRESIA_REPORTS;

/** Todos los reportes que entrega un producto ([] si no entrega ninguno). */
export function reportsForSlug(slug: string): ReportMapping[] {
  return PRODUCT_TO_REPORTS[slug] ?? [];
}

export function isReportSlug(slug: string): boolean {
  return reportsForSlug(slug).length > 0;
}

/** El checkout debe pedir nombre+fecha de la persona para este producto. */
export function slugNeedsPersonInput(slug: string): boolean {
  return reportsForSlug(slug).some((m) => m.kind === 'generated');
}

/** El checkout debe pedir además los datos de la pareja. */
export function slugNeedsPartner(slug: string): boolean {
  return reportsForSlug(slug).some((m) => m.kind === 'generated' && m.needsPartner);
}
