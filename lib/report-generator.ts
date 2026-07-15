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
  person: { name: string; birthDate: string }; // birthDate = "YYYY-MM-DD"
  partner?: { name: string; birthDate: string };
};

/**
 * Genera un reporte en el servicio de Railway y devuelve su URL de descarga.
 * Firma el cuerpo exacto con HMAC-SHA256. Lanza si falla (el caller decide
 * reintentar / marcar error). Es idempotente por (order_id, report).
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
    person: { name: input.person.name, birth_date: input.person.birthDate },
  };
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
