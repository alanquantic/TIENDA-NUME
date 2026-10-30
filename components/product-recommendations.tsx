'use client';

import type { CatalogCard } from '@/lib/queries';
import type { UpsellTarget } from '@/lib/agenda-upsell';
import { useCart } from '@/lib/cart-store';
import { selectCartRecommendations } from '@/lib/cart-recommendations';
import { ProductCard } from '@/components/product-card';

export function ProductRecommendations({ catalog, currentSlug, currentCategory, upsell }: {
  catalog: CatalogCard[];
  currentSlug: string;
  currentCategory: string | null;
  upsell: UpsellTarget | null;
}) {
  const items = useCart(s => s.items);
  const products = selectCartRecommendations(
    catalog.filter(product => product.categorySlug !== currentCategory),
    [currentSlug, ...items.map(item => item.slug)],
    6,
  );
  if (!products.length) return null;

  return (
    <section aria-label="Te pueden interesar estos productos" className="mt-16">
      <div className="mb-6 flex items-center gap-3 border-b border-[hsl(var(--primary)/0.18)] pb-3">
        <span aria-hidden="true" className="h-8 w-1.5 rounded-full bg-gradient-brand" />
        <h2 className="text-2xl font-bold tracking-tight text-[hsl(var(--primary))]">
          Te pueden interesar estos productos
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {products.map(product => <ProductCard key={product.id} product={product} upsell={upsell} />)}
      </div>
    </section>
  );
}
