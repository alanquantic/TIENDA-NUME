import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { products } from '@/lib/db/schema';
import { destroyImage, listImages } from '@/lib/cloudinary';

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
    const result = await listImages({ limit, cursor });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al listar imágenes.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const publicId = searchParams.get('public_id')?.trim();
  const url = searchParams.get('url')?.trim();

  if (!publicId) {
    return NextResponse.json({ error: 'public_id requerido.' }, { status: 400 });
  }

  // Si viene la URL, busca productos que la referencien. Si no viene, hace un LIKE
  // contra el public_id en products.images para atrapar cualquier variante de la URL.
  const inUse = url
    ? await db
        .select({ id: products.id, name: products.name, slug: products.slug })
        .from(products)
        .where(sql`${products.images}::jsonb @> ${JSON.stringify([url])}::jsonb`)
    : await db
        .select({ id: products.id, name: products.name, slug: products.slug })
        .from(products)
        .where(sql`${products.images}::text LIKE ${'%' + publicId + '%'}`);

  if (inUse.length > 0) {
    return NextResponse.json(
      {
        error: 'La imagen está en uso por uno o más productos.',
        products: inUse,
      },
      { status: 409 },
    );
  }

  try {
    await destroyImage(publicId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al borrar la imagen.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
