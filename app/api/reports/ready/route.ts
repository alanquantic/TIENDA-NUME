import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { reportGeneratorConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { generatedReports } from '@/lib/db/schema';
import { markGeneratedReportReady } from '@/lib/report-ready';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ReportReadyPayload = {
  event?: string;
  job_id: string;
  report_row_id: string;
  order_id: string;
  report: string;
  status: 'done' | 'error' | 'queued' | 'running';
  result?: {
    pdf?: { url: string };
    html?: { url?: string | null };
    json?: { url?: string | null };
  } | null;
  error?: string | null;
};

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = reportGeneratorConfig.readyWebhookSecret;
  if (!secret) return false;
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const left = Buffer.from(expected);
  const right = Buffer.from(signature.trim().toLowerCase());
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-signature');

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Firma inválida.' }, { status: 401 });
  }

  let payload: ReportReadyPayload;
  try {
    payload = JSON.parse(rawBody) as ReportReadyPayload;
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  if (!payload.report_row_id || !payload.job_id || !payload.status) {
    return NextResponse.json({ error: 'Payload incompleto.' }, { status: 400 });
  }

  if (payload.status === 'done' && payload.result?.pdf?.url) {
    const result = await markGeneratedReportReady({
      rowId: payload.report_row_id,
      pdfUrl: payload.result.pdf.url,
      previewUrl: payload.result.html?.url ?? null,
      jsonUrl: payload.result.json?.url ?? null,
    });
    return NextResponse.json({ ok: true, status: 'ready', notified: result.notified });
  }

  if (payload.status === 'error') {
    await db
      .update(generatedReports)
      .set({
        status: 'error',
        error: payload.error ?? 'El generador reportó un error.',
        updatedAt: new Date(),
      })
      .where(eq(generatedReports.id, payload.report_row_id));
    return NextResponse.json({ ok: true, status: 'error' });
  }

  await db
    .update(generatedReports)
    .set({
      status: payload.status,
      error: null,
      updatedAt: new Date(),
    })
    .where(eq(generatedReports.id, payload.report_row_id));

  return NextResponse.json({ ok: true, status: payload.status });
}
