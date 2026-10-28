import { NextResponse } from 'next/server';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { generatedReports } from '@/lib/db/schema';

export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Params = { params: { id: string } };

/**
 * Reencola un reporte en 'error' o 'failed': vuelve a 'pending' sin error y
 * sin `attempts` ni `jobId` en el input, para que la siguiente corrida del
 * cron lo reenvíe desde cero con sus 5 intentos completos.
 */
export async function POST(_req: Request, { params }: Params) {
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: 'Reporte no encontrado.' }, { status: 404 });
  }

  const updated = await db
    .update(generatedReports)
    .set({
      status: 'pending',
      error: null,
      input: sql`(${generatedReports.input} - 'attempts') - 'jobId'`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(generatedReports.id, params.id),
        inArray(generatedReports.status, ['error', 'failed']),
      ),
    )
    .returning({ id: generatedReports.id });

  if (updated.length === 0) {
    const [row] = await db
      .select({ status: generatedReports.status })
      .from(generatedReports)
      .where(eq(generatedReports.id, params.id))
      .limit(1);
    if (!row) {
      return NextResponse.json({ error: 'Reporte no encontrado.' }, { status: 404 });
    }
    return NextResponse.json(
      { error: `Solo se reintentan reportes en error o fallidos (este está en "${row.status}").` },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true });
}
