'use client';

import { useState } from 'react';
import type { CatalogCard } from '@/lib/queries';
import { ProductCard } from '@/components/product-card';

export function CartRecommendations({ products }: { products: CatalogCard[] }) {
  const [index, setIndex] = useState(0);
  const pageSize = 3;
  const pages = Math.ceil(products.length / pageSize);
  const current = Math.min(index, Math.max(0, pages - 1));
  const visible = products.slice(current * pageSize, (current + 1) * pageSize);
  if (!products.length) return null;

  return (
    <section aria-label="Productos relacionados" className="mt-2 rounded-2xl bg-[hsl(var(--primary-soft))] p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight">Te puede interesar</h3>
          <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">Descubre algo más para ti</p>
        </div>
        {pages > 1 && <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" aria-label="Ver tres productos anteriores" disabled={current === 0} onClick={() => setIndex(current - 1)} className="grid h-8 w-8 place-items-center rounded-full border border-[hsl(var(--primary)/0.15)] bg-[hsl(var(--background))] text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--muted))] disabled:opacity-30">
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4"><path d="m12 5-5 5 5 5" /></svg>
          </button>
          <button type="button" aria-label="Ver siguientes tres productos" disabled={current === pages - 1} onClick={() => setIndex(current + 1)} className="grid h-8 w-8 place-items-center rounded-full border border-[hsl(var(--primary)/0.15)] bg-[hsl(var(--background))] text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--muted))] disabled:opacity-30">
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4"><path d="m8 5 5 5-5 5" /></svg>
          </button>
        </div>}
      </div>
      <div aria-live="polite" aria-atomic="true">
        <div className="grid grid-cols-3 items-stretch gap-2">
          {visible.map((product, offset) => (
            <ProductCard key={product.id} product={product} compact="tile" listId="cart_related" listName="Te puede interesar" index={current * pageSize + offset} />
          ))}
        </div>
        {pages > 1 && <p className="mt-2.5 text-center text-[11px] tabular-nums text-[hsl(var(--muted-foreground))]">{current * pageSize + 1}–{Math.min((current + 1) * pageSize, products.length)} de {products.length}</p>}
      </div>
    </section>
  );
}
