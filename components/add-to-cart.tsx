'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useCart } from '@/lib/cart-store';
import { useToast } from '@/lib/toast-store';
import { formatDecimal } from '@/lib/money';

export type VariantOption = {
  id: string;
  name: string;
  priceAmount: string;
  stock: number;
  trackInventory: boolean;
};

type Props = {
  productId: string;
  slug: string;
  name: string;
  type: 'digital' | 'physical';
  image: string | null;
  currency: string;
  variants: VariantOption[];
};

export function AddToCart({ productId, slug, name, type, image, currency, variants }: Props) {
  const add = useCart((s) => s.add);
  const show = useToast((s) => s.show);
  const [variantId, setVariantId] = useState(variants[0]?.id ?? '');
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const variant = variants.find((v) => v.id === variantId) ?? variants[0];
  const maxStock = type === 'physical' && variant?.trackInventory ? variant.stock : null;
  const soldOut = maxStock !== null && maxStock <= 0;

  function handleAdd() {
    if (!variant || soldOut) return;
    add(
      {
        variantId: variant.id,
        productId,
        slug,
        name,
        variantName: variants.length > 1 ? variant.name : null,
        priceAmount: variant.priceAmount,
        currency,
        image,
        type,
        maxStock,
      },
      qty,
    );
    setAdded(true);
    show('Agregado al carrito');
  }

  return (
    <div className="space-y-4">
      {variants.length > 1 && (
        <label className="block">
          <span className="text-sm text-[hsl(var(--muted-foreground))]">Opción</span>
          <select
            value={variantId}
            onChange={(e) => {
              setVariantId(e.target.value);
              setAdded(false);
            }}
            className="mt-1 w-full rounded-lg border border-[hsl(var(--border))] bg-transparent px-3 py-2"
          >
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} — {formatDecimal(v.priceAmount, currency)}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="flex items-center gap-3">
        <label className="text-sm text-[hsl(var(--muted-foreground))]">Cantidad</label>
        <input
          type="number"
          min={1}
          max={maxStock ?? 99}
          value={qty}
          onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
          className="w-20 rounded-lg border border-[hsl(var(--border))] bg-transparent px-3 py-2"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleAdd}
          disabled={soldOut}
          className="rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-5 py-2.5 font-medium disabled:opacity-50"
        >
          {soldOut ? 'Agotado' : 'Añadir al carrito'}
        </button>
        {added && (
          <Link href="/carrito" className="text-sm underline underline-offset-4">
            Ver carrito →
          </Link>
        )}
      </div>
    </div>
  );
}
