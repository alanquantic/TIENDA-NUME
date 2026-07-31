import 'server-only';
import { createHmac } from 'node:crypto';
import { isAIReportKey } from './ai-report-products';
import { config, reportGeneratorConfig } from './config';
import type { ReportKey } from './report-catalog';

const GENERATOR_URL = process.env.REPORT_GENERATOR_URL ?? '';
const WEBHOOK_SECRET = process.env.REPORT_WEBHOOK_SECRET ?? '';

export function isReportGeneratorConfigured(): boolean {
  return Boolean(GENERATOR_URL && WEBHOOK_SECRET);
}

export type GenerateInput = {
  orderId: string;
  report: ReportKey;
  /** Solo estaticos con versiones (agenda 2025): color elegido. */
  variant?: string;
  /** Requerido en reportes generados; omitir en estaticos. birthDate = "YYYY-MM-DD" */
  person?: { name: string; birthDate: string };
  partner?: { name: string; birthDate: string };
  /**
   * Sufijo de instancia para desambiguar cuando un mismo pedido genera VARIAS
   * copias del mismo `report` con datos distintos.
   */
  instance?: string;
  notify?: { reportRowId: string };
};

type AIJobStatus = 'queued' | 'running' | 'done' | 'error';

export type AIJobResult = {
  pdf: { path: string; url: string };
  html: { path: string; url: string };
  json: { path: string; url: string };
};

export type AIJobStatusResponse = {
  ok?: boolean;
  job_id: string;
  status: AIJobStatus;
  stage?: string | null;
  report: string;
  order_id: string;
  result?: AIJobResult | null;
  error?: string | null;
};

export type SubmitReportResult =
  | { mode: 'legacy'; url: string }
  | { mode: 'ai'; jobId: string; status: AIJobStatus };

type GeneratorNotifyPayload = {
  callback_url: string;
  callback_secret: string;
  report_row_id: string;
};

function signedBody(payload: Record<string, unknown>): {
  body: string;
  signature: string;
} {
  const body = JSON.stringify(payload);
  const signature = createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
  return { body, signature };
}

function basePayload(input: GenerateInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    order_id: input.orderId,
    report: input.report,
  };
  if (input.variant) payload.variant = input.variant;
  if (input.instance) payload.instance = input.instance;
  if (input.person) {
    payload.person = { name: input.person.name, birth_date: input.person.birthDate };
  }
  if (input.partner) {
    payload.partner = { name: input.partner.name, birth_date: input.partner.birthDate };
  }
  const notify = buildNotifyPayload(input.notify?.reportRowId);
  if (notify) payload.notify = notify;
  return payload;
}

function buildNotifyPayload(reportRowId: string | undefined): GeneratorNotifyPayload | null {
  if (!reportRowId || !reportGeneratorConfig.readyWebhookSecret) return null;
  const baseUrl = config.appUrl.replace(/\/$/, '');
  return {
    callback_url: `${baseUrl}/api/reports/ready`,
    callback_secret: reportGeneratorConfig.readyWebhookSecret,
    report_row_id: reportRowId,
  };
}

async function postJSON<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const { body, signature } = signedBody(payload);
  const res = await fetch(`${GENERATOR_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Signature': signature },
    body,
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => ({}))) as T & {
    ok?: boolean;
    error?: string;
    detail?: unknown;
  };
  if (!res.ok) {
    throw new Error(
      `Generador ${res.status}: ${data?.error ?? 'desconocido'} ${JSON.stringify(data?.detail ?? '')}`,
    );
  }
  return data;
}

/**
 * Genera un reporte en el servicio de Railway:
 * - legacy -> devuelve URL final del PDF
 * - IA     -> encola el job y devuelve su job_id
 */
export async function submitReport(input: GenerateInput): Promise<SubmitReportResult> {
  if (!isReportGeneratorConfigured()) {
    throw new Error(
      'Generador no configurado (falta REPORT_GENERATOR_URL / REPORT_WEBHOOK_SECRET)',
    );
  }

  const payload = basePayload(input);

  if (isAIReportKey(input.report)) {
    const data = await postJSON<{
      ok?: boolean;
      job_id?: string;
      status?: AIJobStatus;
      error?: string;
      detail?: unknown;
    }>('/reports/generate-ai', payload);
    if (!data?.ok || !data.job_id || !data.status) {
      throw new Error(
        `Generador IA: ${data?.error ?? 'desconocido'} ${JSON.stringify(data?.detail ?? '')}`,
      );
    }
    return { mode: 'ai', jobId: data.job_id, status: data.status };
  }

  const data = await postJSON<{
    ok?: boolean;
    url?: string;
    error?: string;
    detail?: unknown;
  }>('/reports/generate', payload);
  if (!data?.ok || !data.url) {
    throw new Error(
      `Generador legacy: ${data?.error ?? 'desconocido'} ${JSON.stringify(data?.detail ?? '')}`,
    );
  }
  return { mode: 'legacy', url: data.url };
}

export async function getAIReportJob(jobId: string): Promise<AIJobStatusResponse> {
  if (!isReportGeneratorConfigured()) {
    throw new Error(
      'Generador no configurado (falta REPORT_GENERATOR_URL / REPORT_WEBHOOK_SECRET)',
    );
  }

  const res = await fetch(`${GENERATOR_URL}/reports/jobs/${jobId}`, {
    method: 'GET',
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => ({}))) as AIJobStatusResponse & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(`Estado job ${res.status}: ${data?.error ?? 'desconocido'}`);
  }
  return data;
}
