import 'server-only';
import { createHmac } from 'node:crypto';
import type { ReportKey } from './report-catalog';

const GENERATOR_URL = process.env.REPORT_GENERATOR_URL ?? '';
const WEBHOOK_SECRET = process.env.REPORT_WEBHOOK_SECRET ?? '';

export function isReportGeneratorConfigured(): boolean {
  return Boolean(GENERATOR_URL && WEBHOOK_SECRET);
}

export type GenerateInput = {
  orderId: string;
  report: ReportKey;
  /** Solo estáticos con versiones (agenda 2025): color elegido. */
  variant?: string;
  /** Requerido en reportes generados; omitir en estáticos. birthDate = "YYYY-MM-DD" */
  person?: { name: string; birthDate: string };
  partner?: { name: string; birthDate: string };
  /**
   * Sufijo de instancia para desambiguar cuando un mismo pedido genera VARIAS
   * copias del mismo `report` con datos distintos (Membresía + Kit → dos
   * "quien-soy" con personas diferentes).
   *
   * El generador debe usar este valor en la ruta de almacenamiento
   * (p. ej. `md5(order_id)/<report>-<instance>.pdf`) para no sobreescribir.
   * Si el generador aún no lo soporta, ambos PDFs comparten ruta y el segundo
   * pisa al primero.
   */
  instance?: string;
};

/**
 * Genera un reporte en el servicio de Railway y devuelve su URL de descarga.
 * Firma el cuerpo exacto con HMAC-SHA256. Lanza si falla (el caller decide
 * reintentar / marcar error). Es idempotente por (order_id, report).
 *
 * El generador valida de forma estricta: enviar campos que no correspondan al
 * tipo de reporte (p. ej. `person` en un estático) puede dar 422. Por eso solo
 * se incluyen los campos presentes.
 */
export async function generateReport(input: GenerateInput): Promise<{ url: string }> {
  if (!isReportGeneratorConfigured()) {
    throw new Error(
      'Generador no configurado (falta REPORT_GENERATOR_URL / REPORT_WEBHOOK_SECRET)',
    );
  }

  const payload: Record<string, unknown> = {
    order_id: input.orderId,
    report: input.report,
  };
  if (input.variant) {
    payload.variant = input.variant;
  }
  if (input.instance) {
    payload.instance = input.instance;
  }
  if (input.person) {
    payload.person = { name: input.person.name, birth_date: input.person.birthDate };
  }
  if (input.partner) {
    payload.partner = { name: input.partner.name, birth_date: input.partner.birthDate };
  }

  const body = JSON.stringify(payload);
  const signature = createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');

  const res = await fetch(`${GENERATOR_URL}/reports/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Signature': signature },
    body,
    cache: 'no-store',
  });

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    url?: string;
    error?: string;
    detail?: unknown;
  };
  if (!res.ok || !data?.ok || !data.url) {
    throw new Error(
      `Generador ${res.status}: ${data?.error ?? 'desconocido'} ${JSON.stringify(data?.detail ?? '')}`,
    );
  }
  return { url: data.url };
}
