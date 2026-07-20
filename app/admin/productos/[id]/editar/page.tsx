import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
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

  const [variant] = await db
    .select()
    .from(productVariants)
    .where(
      and(eq(productVariants.productId, product.id), eq(productVariants.isDefault, true)),
    )
    .limit(1);

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
    type: product.type,
    categoryId: product.categoryId,
    price: variant?.priceAmount ?? '',
    imageUrl: images[0] ?? null,
    status: product.status === 'draft' ? 'draft' : 'active',
    fileUrl: asset?.fileUrl ?? null,
    fileName: asset?.fileName ?? null,
    downloadLimit: asset?.downloadLimit ?? null,
    stock: variant?.stock ?? null,
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
