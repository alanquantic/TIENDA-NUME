import { NextResponse } from 'next/server';
import { and, eq, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { digitalAssets, productVariants, products } from '@/lib/db/schema';
import { adminProductSchema } from '@/lib/validation';

export const runtime = 'nodejs';

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const body = await req.json().catch(() => null);
  const parsed = adminProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos.', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const [existing] = await db
    .select()
    .from(products)
    .where(eq(products.id, params.id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: 'Producto no encontrado.' }, { status: 404 });
  }

  // Slug único (excepto para el mismo producto).
  const [slugClash] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.slug, d.slug), ne(products.id, existing.id)))
    .limit(1);
  if (slugClash) {
    return NextResponse.json(
      { error: `Ya existe otro producto con el slug "${d.slug}".` },
      { status: 409 },
    );
  }

  const image = d.imageUrl && d.imageUrl.length > 0 ? d.imageUrl : null;
  const existingImages = (existing.images as string[] | null) ?? [];
  const nextImages = image
    ? [image, ...existingImages.filter((url) => url !== image)]
    : [];

  await db
    .update(products)
    .set({
      slug: d.slug,
      name: d.name,
      description: d.description ?? null,
      type: d.type,
      status: d.status,
      categoryId: d.categoryId ?? null,
      currency: d.currency,
      images: nextImages,
      weightGrams: d.type === 'physical' ? existing.weightGrams ?? 300 : null,
      updatedAt: new Date(),
    })
    .where(eq(products.id, existing.id));

  // Variante por defecto: se actualiza precio, stock y flag de inventario.
  const [defaultVariant] = await db
    .select()
    .from(productVariants)
    .where(
      and(
        eq(productVariants.productId, existing.id),
        eq(productVariants.isDefault, true),
      ),
    )
    .limit(1);

  if (defaultVariant) {
    await db
      .update(productVariants)
      .set({
        priceAmount: d.price,
        stock: d.type === 'physical' ? d.stock ?? 0 : 0,
        trackInventory: d.type === 'physical',
        updatedAt: new Date(),
      })
      .where(eq(productVariants.id, defaultVariant.id));
  } else {
    await db.insert(productVariants).values({
      productId: existing.id,
      name: 'Default',
      priceAmount: d.price,
      stock: d.type === 'physical' ? d.stock ?? 0 : 0,
      trackInventory: d.type === 'physical',
      isDefault: true,
    });
  }

  // Digital asset: upsert simple sobre el primero, o eliminar si el producto ya no es digital.
  if (d.type === 'digital' && d.fileUrl && d.fileName) {
    const [asset] = await db
      .select()
      .from(digitalAssets)
      .where(eq(digitalAssets.productId, existing.id))
      .limit(1);

    if (asset) {
      await db
        .update(digitalAssets)
        .set({
          fileUrl: d.fileUrl,
          fileName: d.fileName,
          downloadLimit: d.downloadLimit ?? null,
        })
        .where(eq(digitalAssets.id, asset.id));
    } else {
      await db.insert(digitalAssets).values({
        productId: existing.id,
        fileUrl: d.fileUrl,
        fileName: d.fileName,
        contentType: 'application/octet-stream',
        downloadLimit: d.downloadLimit ?? null,
      });
    }
  } else if (d.type === 'physical') {
    await db.delete(digitalAssets).where(eq(digitalAssets.productId, existing.id));
  }

  return NextResponse.json({ id: existing.id, slug: d.slug });
}
