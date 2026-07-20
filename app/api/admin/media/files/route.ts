import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { digitalAssets, products } from '@/lib/db/schema';
import { destroyRawResource, listFiles } from '@/lib/cloudinary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limitRaw = searchParams.get('limit');
  const cursor = searchParams.get('cursor') ?? undefined;

  const limit = limitRaw ? Number(limitRaw) : undefined;
  if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
    return NextResponse.json({ error: 'limit inválido.' }, { status: 400 });
  }

  try {
    const result = await listFiles({ limit, cursor });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al listar archivos.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Borra un archivo raw (PDF/ZIP/…) de Cloudinary solo si ningún digital_asset
 * lo referencia por fileUrl.
 */
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const publicId = searchParams.get('public_id')?.trim();
  const url = searchParams.get('url')?.trim();

  if (!publicId) {
    return NextResponse.json({ error: 'public_id requerido.' }, { status: 400 });
  }
  if (!url) {
    return NextResponse.json({ error: 'url requerida.' }, { status: 400 });
  }

  const inUse = await db
    .select({
      id: digitalAssets.id,
      productId: digitalAssets.productId,
      productName: products.name,
      productSlug: products.slug,
      fileName: digitalAssets.fileName,
    })
    .from(digitalAssets)
    .leftJoin(products, eq(products.id, digitalAssets.productId))
    .where(eq(digitalAssets.fileUrl, url));

  if (inUse.length > 0) {
    return NextResponse.json(
      {
        error: 'El archivo está en uso por uno o más productos.',
        products: inUse.map((row) => ({
          id: row.productId,
          name: row.productName ?? row.fileName,
          slug: row.productSlug ?? '',
        })),
      },
      { status: 409 },
    );
  }

  try {
    await destroyRawResource(publicId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al borrar el archivo.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
