import { NextResponse } from 'next/server';
import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { digitalAssets, downloadGrants } from '@/lib/db/schema';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: { token: string } },
) {
  const [grant] = await db
    .select({
      id: downloadGrants.id,
      downloadsUsed: downloadGrants.downloadsUsed,
      downloadLimit: downloadGrants.downloadLimit,
      expiresAt: downloadGrants.expiresAt,
      fileUrl: digitalAssets.fileUrl,
      fileName: digitalAssets.fileName,
    })
    .from(downloadGrants)
    .innerJoin(digitalAssets, eq(downloadGrants.digitalAssetId, digitalAssets.id))
    .where(eq(downloadGrants.token, params.token))
    .limit(1);

  if (!grant) {
    return NextResponse.json({ error: 'Enlace de descarga inválido.' }, { status: 404 });
  }
  if (grant.expiresAt && grant.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: 'El enlace de descarga expiró.' }, { status: 410 });
  }
  if (grant.downloadLimit != null && grant.downloadsUsed >= grant.downloadLimit) {
    return NextResponse.json(
      { error: 'Se alcanzó el máximo de descargas.' },
      { status: 429 },
    );
  }

  // Incremento atómico: con clics simultáneos solo pasan los que caben en el límite.
  const consumed = await db
    .update(downloadGrants)
    .set({ downloadsUsed: sql`${downloadGrants.downloadsUsed} + 1` })
    .where(
      and(
        eq(downloadGrants.id, grant.id),
        or(
          isNull(downloadGrants.downloadLimit),
          lt(downloadGrants.downloadsUsed, downloadGrants.downloadLimit),
        ),
      ),
    )
    .returning({ id: downloadGrants.id });
  if (consumed.length === 0) {
    return NextResponse.json(
      { error: 'Se alcanzó el máximo de descargas.' },
      { status: 429 },
    );
  }

  // MVP: redirige a la URL del archivo (idealmente una URL firmada de S3/R2).
  return NextResponse.redirect(grant.fileUrl, { status: 302 });
}
