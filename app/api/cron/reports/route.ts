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
};

/**
 * Reprocesa reportes pendientes/errores. Lo llama Vercel Cron (o cualquier
 * scheduler externo) enviando `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  if (!isReportGeneratorConfigured()) {
    return NextResponse.json({ ok: true, nota: 'generador no configurado' });
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
        .set({ status: 'error', error: 'Sin datos de persona', updatedAt: new Date() })
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
          await db
            .update(generatedReports)
            .set({
              status: 'ready',
              url: job.result.pdf.url,
              error: null,
              input: {
                ...input,
                engine,
                instance: instance ?? null,
                previewUrl: job.result.html?.url ?? null,
                jsonUrl: job.result.json?.url ?? null,
              },
              updatedAt: new Date(),
            })
            .where(eq(generatedReports.id, reportRow.id));
          ready++;
          continue;
        }

        if (job.status === 'error') {
          await db
            .update(generatedReports)
            .set({
              status: 'error',
              error: job.error ?? 'El job IA terminó con error.',
              updatedAt: new Date(),
            })
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
        .set({ status: 'error', error: String(error), updatedAt: new Date() })
        .where(eq(generatedReports.id, reportRow.id));
      failed++;
    }
  }

  return NextResponse.json({ ok: true, procesados: pending.length, ready, queued, failed });
}
