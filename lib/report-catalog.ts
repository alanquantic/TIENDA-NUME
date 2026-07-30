import { AI_REPORT_PRODUCTS, type AIReportKey, isAIReportKey } from './ai-report-products';

// Mapeo producto (slug) -> reportes del generador. Sin dependencias server-only:
// tambien lo usa el checkout (cliente) para saber que datos pedir.
//
// El catalogo en vivo del generador esta en GET <REPORT_GENERATOR_URL>/reports.
// Hay dos clases de reporte:
//   - 'generated': se arma con los datos de la persona (y pareja si aplica).
//   - 'static':    PDF pre-hecho; NO se envia person/partner. Algunos tienen
//                  versiones (color) y requieren el campo `variant`.
//
// Un producto puede entregar VARIOS reportes (membresias, kits, bundles). Todos
// los reportes de un mismo producto se generan con los mismos datos de persona.

export type ReportKey =
  // -- Generados legacy (necesitan datos de la persona) --
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
  | 'nuestra-leccion'
  // -- Generados IA (paso 6; endpoint /reports/generate-ai) --
  | AIReportKey
  // -- Estaticos (PDF pre-hecho; NO llevan person/partner) --
  | 'reporte-semestral'
  | 'agenda-numerologica-2026'
  | 'planeador-numerologico-2026'
  | 'agenda-numerologica-2025';

export type ReportEngine = 'legacy' | 'ai';

/** Colores (versiones) del estatico `agenda-numerologica-2025`. */
export type Agenda2025Color = 'azul' | 'verde' | 'naranja' | 'morado';
export const AGENDA_2025_COLORS: Agenda2025Color[] = ['azul', 'verde', 'naranja', 'morado'];

export type ReportMapping = {
  report: ReportKey;
  /** 'generated' pide datos de la persona; 'static' es un PDF pre-hecho. */
  kind: 'generated' | 'static';
  /** 'ai' usa el contrato asincrono nuevo; 'legacy' conserva /reports/generate. */
  engine?: ReportEngine;
  /** Solo 'generated': ademas necesita datos de la pareja. */
  needsPartner: boolean;
  /** Solo 'static' con versiones (agenda 2025): requiere `variant` (color). */
  needsVariant?: boolean;
  /** Etiqueta corta para mostrar en el checkout. */
  label: string;
};

const QUIEN_SOY: ReportMapping = {
  report: 'reporte-quien-soy',
  kind: 'generated',
  engine: 'legacy',
  needsPartner: false,
  label: '¿Quién soy?',
};

/**
 * Producto en la tienda (SLUG) -> reportes a generar.
 * Claves validadas contra el catalogo en vivo del generador (`GET /reports`).
 */
export const PRODUCT_TO_REPORTS: Record<string, ReportMapping[]> = {
  // -- Reportes individuales (generados legacy) --
  'reporte-quien-soy': [QUIEN_SOY],
  'reporte-quien-soy-version-extendida': [
    {
      report: 'reporte-quien-soy-extended',
      kind: 'generated',
      engine: 'legacy',
      needsPartner: false,
      label: '¿Quién soy? extendido',
    },
  ],
  'reporte-etapa-de-vida-2026': [
    {
      report: 'reporte-etapa-de-vida-2026',
      kind: 'generated',
      engine: 'legacy',
      needsPartner: false,
      label: 'Etapa de Vida 2026',
    },
  ],
  'reporte-el-amor-segun-tu-ano-personal': [
    {
      report: 'amor-pareja-ano-personal',
      kind: 'generated',
      engine: 'legacy',
      needsPartner: false,
      label: 'El Amor Según tu Año Personal',
    },
  ],
  'reporte-ano-personal-de-la-pareja-2026': [
    {
      report: 'nuestra-leccion',
      kind: 'generated',
      engine: 'legacy',
      needsPartner: true,
      label: 'Año Personal de la Pareja 2026',
    },
  ],
  'reporte-numerologia-de-pareja': [
    {
      report: 'reporte-pareja',
      kind: 'generated',
      engine: 'legacy',
      needsPartner: true,
      label: 'Numerología de Pareja',
    },
  ],
  'reporte-nuestra-personalidad-de-pareja': [
    {
      report: 'reporte-personalidad-pareja',
      kind: 'generated',
      engine: 'legacy',
      needsPartner: true,
      label: 'Nuestra personalidad de pareja',
    },
  ],
  'reporte-nuestro-antidoto-de-pareja': [
    {
      report: 'reporte-antidoto',
      kind: 'generated',
      engine: 'legacy',
      needsPartner: true,
      label: 'Nuestro Antídoto de Pareja',
    },
  ],
  'reporte-la-herida-que-sano-con-mi-pareja': [
    {
      report: 'reporte-herida',
      kind: 'generated',
      engine: 'legacy',
      needsPartner: true,
      label: 'La herida que sano con mi pareja',
    },
  ],
  'reporte-quien-es-mi-maestro': [
    {
      report: 'reporte-maestro',
      kind: 'generated',
      engine: 'legacy',
      needsPartner: true,
      label: '¿Quién es mi maestro?',
    },
  ],

  // -- Estaticos (PDF pre-hecho) --
  'reporte-semestral-2026': [
    {
      report: 'reporte-semestral',
      kind: 'static',
      needsPartner: false,
      label: 'Reporte Semestral 2026',
    },
  ],
  'agenda-numerologica-2026-digital-pdf': [
    {
      report: 'agenda-numerologica-2026',
      kind: 'static',
      needsPartner: false,
      label: 'Agenda Numerológica 2026',
    },
  ],
  'planeador-numerologico-2026-digital-pdf': [
    {
      report: 'planeador-numerologico-2026',
      kind: 'static',
      needsPartner: false,
      label: 'Planeador Numerológico 2026',
    },
  ],
  'agenda-numerologica-2025-digital-pdf': [
    {
      report: 'agenda-numerologica-2025',
      kind: 'static',
      needsPartner: false,
      needsVariant: true,
      label: 'Agenda Numerológica 2025',
    },
  ],

  // -- Bundles: un producto entrega VARIOS reportes --
  'numerathum-oraculo-365-agenda-numerologica-2026-digital-pdf': [
    {
      report: 'agenda-numerologica-2026',
      kind: 'static',
      needsPartner: false,
      label: 'Agenda Numerológica 2026',
    },
  ],
  'kit-primavera': [
    {
      report: 'reporte-etapa-de-vida-2026',
      kind: 'generated',
      engine: 'legacy',
      needsPartner: false,
      label: 'Etapa de Vida 2026',
    },
    QUIEN_SOY,
    {
      report: 'reporte-lectura-pareja',
      kind: 'generated',
      engine: 'legacy',
      needsPartner: true,
      label: 'Lectura de Pareja',
    },
  ],
};

/** Membresias: entregan los mismos 3 reportes. */
const MEMBRESIA_REPORTS: ReportMapping[] = [
  {
    report: 'nuestra-leccion',
    kind: 'generated',
    engine: 'legacy',
    needsPartner: true,
    label: 'Año Personal de la Pareja',
  },
  QUIEN_SOY,
  {
    report: 'horoscopo',
    kind: 'generated',
    engine: 'legacy',
    needsPartner: false,
    label: 'Horóscopo',
  },
];
PRODUCT_TO_REPORTS['membresia-360'] = MEMBRESIA_REPORTS;
PRODUCT_TO_REPORTS['membresia-180'] = MEMBRESIA_REPORTS;

for (const product of AI_REPORT_PRODUCTS) {
  PRODUCT_TO_REPORTS[product.slug] = [
    {
      report: product.report,
      kind: 'generated',
      engine: 'ai',
      needsPartner: false,
      label: product.label,
    },
  ];
}

/** Todos los reportes que entrega un producto ([] si no entrega ninguno). */
export function reportsForSlug(slug: string): ReportMapping[] {
  return PRODUCT_TO_REPORTS[slug] ?? [];
}

export function isReportSlug(slug: string): boolean {
  return reportsForSlug(slug).length > 0;
}

export function reportEngineForKey(report: ReportKey): ReportEngine {
  return isAIReportKey(report) ? 'ai' : 'legacy';
}

/** El checkout debe pedir nombre+fecha de la persona para este producto. */
export function slugNeedsPersonInput(slug: string): boolean {
  return reportsForSlug(slug).some((mapping) => mapping.kind === 'generated');
}

/** El checkout debe pedir ademas los datos de la pareja. */
export function slugNeedsPartner(slug: string): boolean {
  return reportsForSlug(slug).some(
    (mapping) => mapping.kind === 'generated' && mapping.needsPartner,
  );
}
