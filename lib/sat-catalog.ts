// Catálogos SAT para facturación (CFDI 4.0). Subconjuntos usados en el
// checkout. Sin dependencias server-only: lo consume el formulario (cliente).

/** Régimen fiscal del receptor (c_RegimenFiscal). */
export const REGIMEN_FISCAL: ReadonlyArray<readonly [string, string]> = [
  ['605', '605 · Sueldos y Salarios e Ingresos Asimilados a Salarios'],
  ['612', '612 · Personas Físicas con Actividades Empresariales y Profesionales'],
  ['626', '626 · Régimen Simplificado de Confianza (RESICO)'],
  ['606', '606 · Arrendamiento'],
  ['608', '608 · Demás ingresos'],
  ['611', '611 · Ingresos por Dividendos (socios y accionistas)'],
  ['614', '614 · Ingresos por intereses'],
  ['616', '616 · Sin obligaciones fiscales'],
  ['621', '621 · Incorporación Fiscal'],
  ['625', '625 · Actividades Empresariales con ingresos por Plataformas Tecnológicas'],
  ['601', '601 · General de Ley Personas Morales'],
  ['603', '603 · Personas Morales con Fines no Lucrativos'],
] as const;

/** Uso del CFDI del receptor (c_UsoCFDI). */
export const USO_CFDI: ReadonlyArray<readonly [string, string]> = [
  ['G03', 'G03 · Gastos en general'],
  ['G01', 'G01 · Adquisición de mercancías'],
  ['G02', 'G02 · Devoluciones, descuentos o bonificaciones'],
  ['D10', 'D10 · Pagos por servicios educativos (colegiaturas)'],
  ['I01', 'I01 · Construcciones'],
  ['I08', 'I08 · Otra maquinaria y equipo'],
  ['CP01', 'CP01 · Pagos'],
  ['S01', 'S01 · Sin efectos fiscales'],
] as const;

export const REGIMEN_FISCAL_CODES = REGIMEN_FISCAL.map(([code]) => code);
export const USO_CFDI_CODES = USO_CFDI.map(([code]) => code);
