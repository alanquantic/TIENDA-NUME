import { NextResponse } from 'next/server';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { generatedReports } from '@/lib/db/schema';
import { generateReport, isReportGeneratorConfigured } from '@/lib/report-generator';
import type { ReportKey } from '@/lib/report-catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type StoredInput = {
  kind?: 'generated' | 'static';
  person?: { name: string; birthDate: string } | null;
  partner?: { name: string; birthDate: string } | null;
  variant?: string | null;
  /** Sufijo por-item para desambiguar múltiples copias del mismo reportKey. */
  instance?: string | null;
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
    const isStatic = input.kind === 'static';
    // Los generados requieren datos de la persona; los estáticos no.
    if (!isStatic && !input.person) {
      await db
        .update(generatedReports)
        .set({ status: 'error', error: 'Sin datos de persona', updatedAt: new Date() })
        .where(eq(generatedReports.id, r.id));
      failed++;
      continue;
    }
    try {
      // Si el registro es viejo y no trae instance, deriva uno del orderItemId
      // para que coincida con la ruta que ya usa el generador (si soporta el
      // sufijo). Los registros nuevos siempre traen instance en el input.
      const fallbackInstance = r.orderItemId?.replace(/-/g, '').slice(0, 12);
      const instance = input.instance ?? fallbackInstance ?? undefined;

      const { url } = await generateReport({
        orderId: r.orderId,
        report: r.reportKey as ReportKey,
        variant: input.variant ?? undefined,
        person: input.person ?? undefined,
        partner: input.partner ?? undefined,
        instance,
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
