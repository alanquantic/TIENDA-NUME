import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getProductBySlug, getRelatedProducts } from '@/lib/queries';
import { AddToCart, type VariantOption } from '@/components/add-to-cart';
import { ProductGallery } from '@/components/product-gallery';
import { ProductDescription } from '@/components/product-description';
import { ProductCard } from '@/components/product-card';
import { formatDecimal } from '@/lib/money';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const data = await getProductBySlug(params.slug);
  if (!data) return { title: 'Producto no encontrado' };
  return { title: data.product.name, description: data.product.description ?? undefined };
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const data = await getProductBySlug(params.slug);
  if (!data) notFound();

  const { product, variants } = data;
  const images = (product.images as string[]) ?? [];
  const fromPrice = variants.reduce(
    (min, v) => (parseFloat(v.priceAmount) < parseFloat(min) ? v.priceAmount : min),
    variants[0]?.priceAmount ?? '0',
  );

  const variantOptions: VariantOption[] = variants.map((v) => ({
    id: v.id,
    name: v.name,
    priceAmount: v.priceAmount,
    stock: v.stock,
    trackInventory: v.trackInventory,
  }));

  const related = await getRelatedProducts(product.categoryId, product.id);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
      <div className="grid gap-10 md:grid-cols-2">
        <ProductGallery images={images} name={product.name} />

        <div>
          <span className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            {product.type === 'digital' ? 'Producto digital' : 'Producto físico'}
          </span>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{product.name}</h1>
          <p className="mt-3 text-2xl font-semibold text-[hsl(var(--primary))]">
            {formatDecimal(fromPrice, product.currency)}
          </p>

          <div className="mt-8">
            <AddToCart
              productId={product.id}
              slug={product.slug}
              name={product.name}
              type={product.type}
              image={images[0] ?? null}
              currency={product.currency}
              variants={variantOptions}
              maxPerOrder={product.maxPerOrder}
            />
          </div>

          {product.type === 'digital' && (
            <p className="mt-6 text-sm text-[hsl(var(--muted-foreground))]">
              Recibirás un enlace de descarga por correo tras la compra.
            </p>
          )}
        </div>
      </div>

      {product.description && (
        <div className="mt-12 max-w-3xl">
          <h2 className="mb-4 text-lg font-semibold">Descripción</h2>
          <ProductDescription text={product.description} />
        </div>
      )}

      {related.length > 0 && (
        <div className="mt-16">
          <h2 className="mb-4 text-lg font-semibold">Productos relacionados</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
