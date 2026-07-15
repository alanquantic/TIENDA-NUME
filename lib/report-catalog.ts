// Mapeo producto (slug) → reporte del generador. Sin dependencias server-only:
// también lo usa el checkout (cliente) para saber qué datos pedir.

export type ReportKey =
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
  | 'reporte-lectura-pareja';

export type ReportMapping = {
  report: ReportKey;
  needsPartner: boolean;
  /** Etiqueta corta para mostrar en el checkout. */
  label: string;
};

/**
 * Producto en la tienda (SLUG) → reporte a generar.
 * Confirmado con el cliente el 2026-07-14.
 * NOTA: "Reporte Semestral 2026" (reporte-semestral-2026) NO se genera.
 * "horoscopo" y "reporte-lectura-pareja" existen en el generador para bundles
 * futuros; hoy no tienen producto propio.
 */
export const PRODUCT_TO_REPORT: Record<string, ReportMapping> = {
  'reporte-quien-soy': { report: 'reporte-quien-soy', needsPartner: false, label: '¿Quién soy?' },
  'reporte-quien-soy-version-extendida': {
    report: 'reporte-quien-soy-extended',
    needsPartner: false,
    label: '¿Quién soy? extendido',
  },
  'reporte-etapa-de-vida-2026': {
    report: 'reporte-etapa-de-vida-2026',
    needsPartner: false,
    label: 'Etapa de Vida 2026',
  },
  'reporte-el-amor-segun-tu-ano-personal': {
    report: 'amor-pareja-ano-personal',
    needsPartner: false,
    label: 'El Amor Según tu Año Personal',
  },
  // PENDIENTE: "Reporte: Año Personal de la Pareja 2026"
  // (reporte-ano-personal-de-la-pareja-2026) necesita su PROPIA clave en el
  // generador — colisionaba con amor-pareja-ano-personal. Agregar aquí cuando
  // el cliente confirme la clave correcta (y si requiere pareja):
  // 'reporte-ano-personal-de-la-pareja-2026': { report: '<clave>', needsPartner: ?, label: 'Año Personal de la Pareja 2026' },
  'reporte-numerologia-de-pareja': {
    report: 'reporte-pareja',
    needsPartner: true,
    label: 'Numerología de Pareja',
  },
  'reporte-nuestra-personalidad-de-pareja': {
    report: 'reporte-personalidad-pareja',
    needsPartner: true,
    label: 'Nuestra personalidad de pareja',
  },
  'reporte-nuestro-antidoto-de-pareja': {
    report: 'reporte-antidoto',
    needsPartner: true,
    label: 'Nuestro Antídoto de Pareja',
  },
  'reporte-la-herida-que-sano-con-mi-pareja': {
    report: 'reporte-herida',
    needsPartner: true,
    label: 'La herida que sano con mi pareja',
  },
  'reporte-quien-es-mi-maestro': {
    report: 'reporte-maestro',
    needsPartner: true,
    label: '¿Quién es mi maestro?',
  },
};

export function reportForSlug(slug: string): ReportMapping | undefined {
  return PRODUCT_TO_REPORT[slug];
}

export function isReportSlug(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(PRODUCT_TO_REPORT, slug);
}
