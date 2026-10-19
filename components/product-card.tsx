'use client';

import Link from 'next/link';
import { catalogCardToGaItem, track } from '@/lib/analytics';
import { useCart } from '@/lib/cart-store';
import { useToast } from '@/lib/toast-store';
import type { CatalogCard } from '@/lib/queries';
import { discountPercent } from '@/lib/sale-price';
import { PriceWithSale, SaleBadge } from '@/components/sale-price';
import { isPreviousAgenda, type UpsellTarget } from '@/lib/agenda-upsell';
import { useUpsell } from '@/lib/upsell-store';

export function ProductCard({
  product,
  listId,
  listName,
  index,
  upsell = null,
  compact = false,
}: {
  product: CatalogCard;
  listId?: string;
  listName?: string;
  index?: number;
  /** Agenda 2027 a ofrecer si este producto es una agenda anterior. */
  upsell?: UpsellTarget | null;
  compact?: boolean | 'tile';
}) {
  const add = useCart((s) => s.add);
  const show = useToast((s) => s.show);
  const showUpsell = useUpsell((s) => s.show);
  const hasOptions = product.variantCount > 1;
  // Con opciones, "agotado" solo si TODAS las variantes lo están.
  const soldOut = hasOptions
    ? !product.inStock
    : product.maxStock !== null && product.maxStock <= 0;
  const onSale = product.regularPriceAmount !== null;
  const percent = discountPercent({
    priceAmount: product.priceAmount,
    regularPriceAmount: product.regularPriceAmount,
    onSale,
    saleEndsAt: product.saleEndsAt,
  });

  function gaItem() {
    return catalogCardToGaItem(product, {
      list_id: listId,
      list_name: listName,
      index,
    });
  }

  function handleSelect() {
    track('select_item', {
      item_list_id: listId,
      item_list_name: listName,
      items: [gaItem()],
    });
  }

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
    const item = { ...gaItem(), quantity: 1 };
    track('add_to_cart', {
      currency: product.currency,
      value: (item.price ?? 0) * (item.quantity ?? 1),
      items: [item],
    });
    show('Agregado al carrito');
    if (upsell && isPreviousAgenda(product.slug, product.categorySlug)) {
      showUpsell({ ...upsell, productName: product.name });
    }
  }

  if (compact) {
    return (
      <div className={`flex min-w-0 rounded-2xl border border-[hsl(var(--primary)/0.12)] bg-[hsl(var(--card))] shadow-sm ${compact === 'tile' ? 'flex-col overflow-hidden' : 'items-center gap-4 p-3'}`}>
        <Link href={`/productos/${product.slug}`} onClick={handleSelect} className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-[hsl(var(--muted))] ${compact === 'tile' ? 'aspect-square w-full' : 'h-28 w-24 rounded-xl sm:w-28'}`}>
          {product.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image} alt={product.name} className="h-full w-full object-contain" />
          ) : <span className="text-center text-xs text-[hsl(var(--muted-foreground))]">Sin imagen</span>}
        </Link>
        <div className={`min-w-0 flex-1 ${compact === 'tile' ? 'flex flex-col p-2' : ''}`}>
          {compact !== 'tile' && <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-[hsl(var(--muted-foreground))]">{product.type === 'digital' ? 'Producto digital' : 'Producto físico'}</p>}
          <Link href={`/productos/${product.slug}`} onClick={handleSelect} title={product.name} className={`line-clamp-2 font-semibold leading-snug hover:text-[hsl(var(--primary))] ${compact === 'tile' ? 'min-h-8 text-xs' : 'text-sm'}`}>{product.name}</Link>
          <div className={`mt-1.5 font-semibold ${compact === 'tile' ? 'mb-2 text-xs' : 'text-sm'}`}>
            {product.priceFrom && <span className="mr-1 text-xs font-normal text-[hsl(var(--muted-foreground))]">Desde</span>}
            <PriceWithSale priceAmount={product.priceAmount} regularPriceAmount={product.regularPriceAmount} currency={product.currency} />
          </div>
          {hasOptions && !soldOut ? (
            <Link href={`/productos/${product.slug}`} onClick={handleSelect} className={`inline-flex min-h-9 items-center justify-center gap-1 rounded-full border border-[hsl(var(--primary)/0.3)] py-1.5 text-xs font-semibold text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--primary-soft))] ${compact === 'tile' ? 'mt-auto px-1' : 'mt-2.5 px-4'}`}>
              {compact === 'tile' ? 'Elegir' : 'Elegir opción'} <span aria-hidden="true">→</span>
            </Link>
          ) : (
            <button type="button" onClick={handleAdd} disabled={soldOut} aria-label={soldOut ? `${product.name}: agotado` : `Agregar ${product.name} al carrito`} className={`inline-flex min-h-9 items-center justify-center gap-1 rounded-full bg-[hsl(var(--primary))] py-1.5 text-xs font-semibold text-[hsl(var(--primary-foreground))] transition-opacity hover:opacity-90 disabled:opacity-50 ${compact === 'tile' ? 'mt-auto px-1' : 'mt-2.5 px-4'}`}>
              {!soldOut && compact !== 'tile' && <span aria-hidden="true" className="text-base leading-none">+</span>}{soldOut ? 'Agotado' : compact === 'tile' ? 'Agregar' : 'Agregar al carrito'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] transition-shadow hover:shadow-md">
      <Link href={`/productos/${product.slug}`} className="block" onClick={handleSelect}>
        <div className="relative aspect-square overflow-hidden bg-[hsl(var(--muted))]">
          {onSale && <SaleBadge percent={percent} className="absolute left-2 top-2 z-10" />}
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
          onClick={handleSelect}
          className="font-medium leading-tight line-clamp-2 hover:underline"
        >
          {product.name}
        </Link>

        <p className="mt-2 font-semibold">
          {product.priceFrom && (
            <span className="mr-1 text-xs font-normal text-[hsl(var(--muted-foreground))]">
              Desde
            </span>
          )}
          <PriceWithSale
            priceAmount={product.priceAmount}
            regularPriceAmount={product.regularPriceAmount}
            currency={product.currency}
          />
        </p>

        {hasOptions && !soldOut ? (
          <Link
            href={`/productos/${product.slug}`}
            onClick={handleSelect}
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-opacity hover:opacity-90"
          >
            Elegir opción
          </Link>
        ) : (
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
        )}
      </div>
    </div>
  );
}
