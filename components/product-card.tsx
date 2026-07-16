'use client';

import Link from 'next/link';
import { useCart } from '@/lib/cart-store';
import { useToast } from '@/lib/toast-store';
import { formatDecimal } from '@/lib/money';
import type { CatalogCard } from '@/lib/queries';

export function ProductCard({ product }: { product: CatalogCard }) {
  const add = useCart((s) => s.add);
  const show = useToast((s) => s.show);
  const soldOut = product.maxStock !== null && product.maxStock <= 0;

  function handleAdd() {
    if (soldOut) return;
    add({
      variantId: product.variantId,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      variantName: null,
      priceAmount: product.priceAmount,
      currency: product.currency,
      image: product.image,
      type: product.type,
      maxStock: product.maxStock,
      maxPerOrder: product.maxPerOrder,
    });
    show('Agregado al carrito');
  }

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] transition-shadow hover:shadow-md">
      <Link href={`/productos/${product.slug}`} className="block">
        <div className="aspect-square overflow-hidden bg-[hsl(var(--muted))]">
          {product.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image}
              alt={product.name}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-sm text-[hsl(var(--muted-foreground))]">
              Sin imagen
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <div className="mb-1 flex items-center gap-2 text-xs">
          <span className="uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            {product.type === 'digital' ? 'Digital' : 'Físico'}
          </span>
          {!product.inStock && <span className="text-red-500">Agotado</span>}
        </div>

        <Link
          href={`/productos/${product.slug}`}
          className="font-medium leading-tight line-clamp-2 hover:underline"
        >
          {product.name}
        </Link>

        <p className="mt-2 font-semibold text-[hsl(var(--primary))]">
          {formatDecimal(product.priceAmount, product.currency)}
        </p>

        <button
          onClick={handleAdd}
          disabled={soldOut}
          className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {soldOut ? (
            'Agotado'
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              Agregar
            </>
          )}
        </button>
      </div>
    </div>
  );
}
