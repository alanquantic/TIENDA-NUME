/**
 * Fin de la preventa de la Agenda 2027. La oferta termina sola por las fechas de
 * sus variantes; el nombre y la descripción los actualiza una sola vez el cron
 * /api/cron/agenda-preventa (00:01 h del 1 de noviembre, Ciudad de México).
 */
export const AGENDA_PRESALE_ENDS_AT = '2026-11-01T00:00:00-06:00';

export function hasAgendaPresaleEnded(now: Date = new Date()) {
  return now.getTime() >= Date.parse(AGENDA_PRESALE_ENDS_AT);
}

/** Quita "Preventa" del nombre y la línea de pre-venta del inicio de la descripción. */
export function withoutAgendaPresale(product: { name: string; description: string | null }) {
  return {
    name: product.name.replace(/\s*\bpre-?venta\b\s*/i, ' ').trim(),
    description: product.description?.replace(/^[^\n]*pre-?venta[^\n]*\n*/i, '') ?? null,
  };
}
