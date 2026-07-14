import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { digitalAssets, productVariants, products } from '@/lib/db/schema';
import { adminProductSchema } from '@/lib/validation';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = adminProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos.', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const image = d.imageUrl && d.imageUrl.length > 0 ? d.imageUrl : null;

  const [product] = await db
    .insert(products)
    .values({
      slug: d.slug,
      name: d.name,
      description: d.description ?? null,
      type: d.type,
      status: d.status,
      categoryId: d.categoryId ?? null,
      currency: d.currency,
      images: image ? [image] : [],
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

  await db.insert(productVariants).values({
    productId: product.id,
    name: 'Default',
    priceAmount: d.price,
    stock: d.type === 'physical' ? d.stock ?? 0 : 0,
    trackInventory: d.type === 'physical',
    isDefault: true,
  });

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
