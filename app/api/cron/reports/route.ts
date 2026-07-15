import { NextResponse } from 'next/server';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { generatedReports } from '@/lib/db/schema';
import { generateReport, isReportGeneratorConfigured } from '@/lib/report-generator';
import type { ReportKey } from '@/lib/report-catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type StoredInput = {
  person?: { name: string; birthDate: string };
  partner?: { name: string; birthDate: string } | null;
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
    .where(inArray(generatedReports.status, ['pending', 'error', 'skipped']))
    .limit(25);

  let ready = 0;
  let failed = 0;

  for (const r of pending) {
    const input = (r.input ?? {}) as StoredInput;
    if (!input.person) {
      await db
        .update(generatedReports)
        .set({ status: 'error', error: 'Sin datos de persona', updatedAt: new Date() })
        .where(eq(generatedReports.id, r.id));
      failed++;
      continue;
    }
    try {
      const { url } = await generateReport({
        orderId: r.orderId,
        report: r.reportKey as ReportKey,
        person: input.person,
        partner: input.partner ?? undefined,
      });
      await db
        .update(generatedReports)
        .set({ status: 'ready', url, error: null, updatedAt: new Date() })
        .where(eq(generatedReports.id, r.id));
      ready++;
    } catch (e) {
      await db
        .update(generatedReports)
        .set({ status: 'error', error: String(e), updatedAt: new Date() })
        .where(eq(generatedReports.id, r.id));
      failed++;
    }
  }

  return NextResponse.json({ ok: true, procesados: pending.length, ready, failed });
}
