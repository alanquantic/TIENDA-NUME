import { NextResponse } from 'next/server';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { generatedReports } from '@/lib/db/schema';
import {
  getAIReportJob,
  isReportGeneratorConfigured,
  submitReport,
} from '@/lib/report-generator';
import {
  reportEngineForKey,
  type ReportEngine,
  type ReportKey,
} from '@/lib/report-catalog';
import { markGeneratedReportReady } from '@/lib/report-ready';
import { expireAbandonedOrders } from '@/lib/payments/expire';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type StoredInput = {
  kind?: 'generated' | 'static';
  engine?: ReportEngine;
  person?: { name: string; birthDate: string } | null;
  partner?: { name: string; birthDate: string } | null;
  variant?: string | null;
  /** Sufijo por-item para desambiguar multiples copias del mismo reportKey. */
  instance?: string | null;
  jobId?: string | null;
  previewUrl?: string | null;
  jsonUrl?: string | null;
  /** Intentos fallidos acumulados; al llegar a MAX_ATTEMPTS el reporte queda 'failed'. */
  attempts?: number;
};

/**
 * Tope de reintentos por reporte. Un reporte que falla 5 veces queda en
 * 'failed' y el cron deja de tocarlo (se revisa a mano), para no gastar cómputo
 * de Neon ni llamar al generador indefinidamente.
 */
const MAX_ATTEMPTS = 5;

/** Estado tras un fallo más: 'error' (se reintenta) o 'failed' (definitivo). */
function failureUpdate(input: StoredInput, error: string) {
  const attempts = (input.attempts ?? 0) + 1;
  return {
    status: attempts >= MAX_ATTEMPTS ? 'failed' : 'error',
    error,
    input: { ...input, attempts },
    updatedAt: new Date(),
  };
}

/**
 * Tareas horarias (Vercel Cron, ver vercel.json), con `Authorization: Bearer
 * <CRON_SECRET>`. Van en una sola corrida para despertar la base de Neon una
 * vez por hora:
 *  1. Cancela pedidos abandonados (sin pago tras 1 hora) y avisa al cliente.
 *  2. Reprocesa reportes pendientes/errores. Es solo una red de seguridad: el
 *     aviso normal de "reporte listo" llega por /api/reports/ready.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  let pedidos: Awaited<ReturnType<typeof expireAbandonedOrders>> | { error: string };
  try {
    pedidos = await expireAbandonedOrders();
  } catch (err) {
    console.error('[cron] fallo al revisar pedidos abandonados', err);
    pedidos = { error: String(err) };
  }

  if (!isReportGeneratorConfigured()) {
    return NextResponse.json({ ok: true, pedidos, nota: 'generador no configurado' });
  }

  const pending = await db
    .select()
    .from(generatedReports)
    .where(inArray(generatedReports.status, ['pending', 'queued', 'running', 'error', 'skipped']))
    .limit(25);

  let ready = 0;
  let queued = 0;
  let failed = 0;

  for (const reportRow of pending) {
    const input = (reportRow.input ?? {}) as StoredInput;
    const isStatic = input.kind === 'static';
    const engine = input.engine ?? reportEngineForKey(reportRow.reportKey as ReportKey);

    if (!isStatic && !input.person) {
      await db
        .update(generatedReports)
        .set({ status: 'failed', error: 'Sin datos de persona', updatedAt: new Date() })
        .where(eq(generatedReports.id, reportRow.id));
      failed++;
      continue;
    }

    try {
      const fallbackInstance = reportRow.orderItemId?.replace(/-/g, '').slice(0, 12);
      const instance = input.instance ?? fallbackInstance ?? undefined;

      if (engine === 'ai') {
        if (!input.jobId) {
          const submission = await submitReport({
            orderId: reportRow.orderId,
            report: reportRow.reportKey as ReportKey,
            variant: input.variant ?? undefined,
            person: input.person ?? undefined,
            partner: input.partner ?? undefined,
            instance,
          });

          if (submission.mode !== 'ai') {
            throw new Error(`Se esperaba job IA para ${reportRow.reportKey}`);
          }

          await db
            .update(generatedReports)
            .set({
              status: submission.status,
              error: null,
              input: { ...input, engine, instance: instance ?? null, jobId: submission.jobId },
              updatedAt: new Date(),
            })
            .where(eq(generatedReports.id, reportRow.id));
          queued++;
          continue;
        }

        const job = await getAIReportJob(input.jobId);
        if (job.status === 'done' && job.result?.pdf?.url) {
          await markGeneratedReportReady({
            rowId: reportRow.id,
            pdfUrl: job.result.pdf.url,
            previewUrl: job.result.html?.url ?? null,
            jsonUrl: job.result.json?.url ?? null,
          });
          ready++;
          continue;
        }

        if (job.status === 'error') {
          await db
            .update(generatedReports)
            .set(failureUpdate(input, job.error ?? 'El job IA terminó con error.'))
            .where(eq(generatedReports.id, reportRow.id));
          failed++;
          continue;
        }

        await db
          .update(generatedReports)
          .set({ status: job.status, error: null, updatedAt: new Date() })
          .where(eq(generatedReports.id, reportRow.id));
        queued++;
        continue;
      }

      const result = await submitReport({
        orderId: reportRow.orderId,
        report: reportRow.reportKey as ReportKey,
        variant: input.variant ?? undefined,
        person: input.person ?? undefined,
        partner: input.partner ?? undefined,
        instance,
      });

      if (result.mode !== 'legacy') {
        throw new Error(`Se esperaba resultado legacy para ${reportRow.reportKey}`);
      }

      await db
        .update(generatedReports)
        .set({ status: 'ready', url: result.url, error: null, updatedAt: new Date() })
        .where(eq(generatedReports.id, reportRow.id));
      ready++;
    } catch (error) {
      await db
        .update(generatedReports)
        .set(failureUpdate(input, String(error)))
        .where(eq(generatedReports.id, reportRow.id));
      failed++;
    }
  }

  return NextResponse.json({ ok: true, pedidos, procesados: pending.length, ready, queued, failed });
}
