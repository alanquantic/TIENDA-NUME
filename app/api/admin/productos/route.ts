import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { digitalAssets, products } from '@/lib/db/schema';
import { adminProductSchema } from '@/lib/validation';
import { saveProductVariants, VariantSaveError } from '@/lib/admin-product-variants';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = adminProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos inválidos.', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const images = Array.from(
    new Set(
      (d.imageUrls && d.imageUrls.length > 0
        ? d.imageUrls
        : d.imageUrl && d.imageUrl.length > 0
          ? [d.imageUrl]
          : []
      ).filter((url) => url.length > 0),
    ),
  );

  const [product] = await db
    .insert(products)
    .values({
      slug: d.slug,
      name: d.name,
      description: d.description ?? null,
      shortDescription: d.shortDescription || null,
      type: d.type,
      status: d.status,
      categoryId: d.categoryId ?? null,
      currency: d.currency,
      images,
      weightGrams: d.type === 'physical' ? 300 : null,
    })
    .onConflictDoNothing({ target: products.slug })
    .returning();

  if (!product) {
    return NextResponse.json(
      { error: `Ya existe un producto con el slug "${d.slug}".` },
      { status: 409 },
    );
  }

  try {
    await saveProductVariants(product.id, d, {});
  } catch (error) {
    // Sin variantes el producto no se puede vender: se deshace el alta.
    await db.delete(products).where(eq(products.id, product.id));
    if (error instanceof VariantSaveError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }

  if (d.type === 'digital' && d.fileUrl && d.fileName) {
    await db.insert(digitalAssets).values({
      productId: product.id,
      fileUrl: d.fileUrl,
      fileName: d.fileName,
      contentType: 'application/octet-stream',
      downloadLimit: d.downloadLimit ?? null,
    });
  }

  return NextResponse.json({ id: product.id, slug: product.slug });
}
