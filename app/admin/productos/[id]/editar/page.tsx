import { notFound } from 'next/navigation';
import { asc, desc, eq } from 'drizzle-orm';
import { readVariationAttributes } from '@/lib/variations';
import { db } from '@/lib/db';
import { digitalAssets, productVariants, products } from '@/lib/db/schema';
import { listCategories } from '@/lib/queries';
import { config } from '@/lib/config';
import { ProductForm, type ProductFormValues } from '@/components/admin/product-form';

export const dynamic = 'force-dynamic';

export default async function EditarProductoPage({
  params,
}: {
  params: { id: string };
}) {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, params.id))
    .limit(1);

  if (!product) notFound();

  const variants = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, product.id))
    .orderBy(desc(productVariants.isDefault), asc(productVariants.createdAt));
  const variant = variants.find((v) => v.isDefault) ?? variants[0];
  const attributes = readVariationAttributes(product.metadata, variants);
  // Activadas si ya hay más de una variante o variantes con atributos (Agenda 2025).
  const variationsEnabled = variants.length > 1 || attributes.length > 0;

  const [asset] =
    product.type === 'digital'
      ? await db
          .select()
          .from(digitalAssets)
          .where(eq(digitalAssets.productId, product.id))
          .limit(1)
      : [];

  const images = (product.images as string[] | null) ?? [];
  const initialValues: ProductFormValues = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    shortDescription: product.shortDescription,
    type: product.type,
    categoryId: product.categoryId,
    price: variant?.priceAmount ?? '',
    imageUrl: images[0] ?? null,
    imageUrls: images,
    status: product.status === 'draft' ? 'draft' : 'active',
    fileUrl: asset?.fileUrl ?? null,
    fileName: asset?.fileName ?? null,
    downloadLimit: asset?.downloadLimit ?? null,
    // Sin control de inventario = campo vacío ("siempre disponible").
    stock: variant?.trackInventory ? variant.stock : null,
    salePrice: variant?.salePriceAmount ?? '',
    saleStartsAt: variant?.saleStartsAt ? variant.saleStartsAt.toISOString() : null,
    saleEndsAt: variant?.saleEndsAt ? variant.saleEndsAt.toISOString() : null,
    variations: {
      enabled: variationsEnabled,
      attributes: attributes.map((a) => ({ name: a.name, values: a.values })),
      variants: variationsEnabled
        ? variants.map((v) => ({
            id: v.id,
            name: v.name,
            attributes: (v.attributes as Record<string, string>) ?? {},
            price: v.priceAmount,
            salePrice: v.salePriceAmount ?? '',
            stock: v.trackInventory ? v.stock : null,
            sku: v.sku ?? '',
            isDefault: v.isDefault,
          }))
        : [],
    },
  };

  const categories = await listCategories();

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Editar producto</h1>
      <ProductForm
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        defaultCurrency={config.currency}
        initialValues={initialValues}
        mode="edit"
      />
    </div>
  );
}
