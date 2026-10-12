'use client';

import Link from 'next/link';
import { useState } from 'react';
import { track } from '@/lib/analytics';
import { useCart } from '@/lib/cart-store';
import { useToast } from '@/lib/toast-store';
import { formatDecimal } from '@/lib/money';
import type { VariationAttribute } from '@/lib/variations';
import { PriceWithSale } from '@/components/sale-price';

export type VariantOption = {
  id: string;
  name: string;
  /** Combinación de atributos (`{ color: 'morado' }`); vacío si no hay variaciones. */
  attributes: Record<string, string>;
  /** Precio vigente (de oferta si aplica). */
  priceAmount: string;
  /** Precio regular tachado; null si no hay oferta vigente. */
  regularPriceAmount: string | null;
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
  /** Tope de unidades por pedido (null = sin tope). */
  maxPerOrder: number | null;
  /** Atributos de las variaciones; si hay, se elige por atributo en vez de una lista. */
  attributes?: VariationAttribute[];
};

const same = (a: string | undefined, b: string | undefined) =>
  (a ?? '').toLowerCase() === (b ?? '').toLowerCase();

function matches(variant: VariantOption, selection: Record<string, string>, attrs: VariationAttribute[]) {
  return attrs.every((a) => same(variant.attributes[a.key], selection[a.key]));
}

export function AddToCart({
  productId,
  slug,
  name,
  type,
  image,
  currency,
  variants,
  maxPerOrder,
  attributes = [],
}: Props) {
  const add = useCart((s) => s.add);
  const show = useToast((s) => s.show);
  const [variantId, setVariantId] = useState(variants[0]?.id ?? '');
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const byAttributes = attributes.length > 0 && variants.length > 1;
  const [selection, setSelection] = useState<Record<string, string>>(
    () => variants[0]?.attributes ?? {},
  );
  const variant = byAttributes
    ? variants.find((v) => matches(v, selection, attributes))
    : (variants.find((v) => v.id === variantId) ?? variants[0]);

  // El precio de la opción elegida solo se muestra si cambia entre opciones.
  const pricesVary =
    new Set(variants.map((v) => `${v.priceAmount}|${v.regularPriceAmount ?? ''}`)).size > 1;

  function isSoldOut(v: VariantOption) {
    return type === 'physical' && v.trackInventory && v.stock <= 0;
  }

  function choose(key: string, value: string) {
    setSelection((prev) => ({ ...prev, [key]: value }));
    setAdded(false);
  }
  const maxStock = type === 'physical' && variant?.trackInventory ? variant.stock : null;
  const soldOut = maxStock !== null && maxStock <= 0;
  // Tope visible: el menor entre stock y límite por pedido.
  const cap = Math.min(maxStock ?? Infinity, maxPerOrder ?? Infinity);
  const limitedToOne = maxPerOrder === 1;

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
        maxPerOrder,
      },
      qty,
    );
    const price = parseFloat(variant.priceAmount) || 0;
    track('add_to_cart', {
      currency,
      value: price * qty,
      items: [
        {
          item_id: variant.id,
          item_name: name,
          item_variant: variants.length > 1 ? variant.name : undefined,
          item_category: type === 'digital' ? 'digital' : 'physical',
          price,
          quantity: qty,
          currency,
        },
      ],
    });
    setAdded(true);
    show('Agregado al carrito');
  }

  return (
    <div className="space-y-4">
      {byAttributes &&
        attributes.map((attribute) => (
          <div key={attribute.key}>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {attribute.name}:{' '}
              <span className="font-medium capitalize text-[hsl(var(--foreground))]">
                {selection[attribute.key] ?? '—'}
              </span>
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {attribute.values.map((value) => {
                const candidate = variants.find((v) =>
                  matches(v, { ...selection, [attribute.key]: value }, attributes),
                );
                const selected = same(selection[attribute.key], value);
                const soldOutOption = candidate ? isSoldOut(candidate) : false;
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={!candidate}
                    aria-pressed={selected}
                    onClick={() => choose(attribute.key, value)}
                    className={`rounded-lg border px-3 py-1.5 text-sm capitalize transition ${
                      selected
                        ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary-soft))] font-medium text-[hsl(var(--primary))]'
                        : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]'
                    } ${soldOutOption ? 'line-through opacity-60' : ''} disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

      {byAttributes && variant && pricesVary && (
        <p className="text-xl font-semibold">
          <PriceWithSale
            priceAmount={variant.priceAmount}
            regularPriceAmount={variant.regularPriceAmount}
            currency={currency}
          />
        </p>
      )}
      {byAttributes && !variant && (
        <p className="text-sm text-red-500">Esa combinación no está disponible.</p>
      )}

      {!byAttributes && variants.length > 1 && (
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

      {limitedToOne ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Límite: 1 por pedido.
        </p>
      ) : (
        <div className="flex items-center gap-3">
          <label className="text-sm text-[hsl(var(--muted-foreground))]">Cantidad</label>
          <input
            type="number"
            min={1}
            max={Number.isFinite(cap) ? cap : 99}
            value={qty}
            onChange={(e) =>
              setQty(Math.max(1, Math.min(Number(e.target.value) || 1, Number.isFinite(cap) ? cap : 99)))
            }
            className="w-20 rounded-lg border border-[hsl(var(--border))] bg-transparent px-3 py-2"
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleAdd}
          disabled={soldOut || !variant}
          className="rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-5 py-2.5 font-medium disabled:opacity-50"
        >
          {!variant ? 'No disponible' : soldOut ? 'Agotado' : 'Añadir al carrito'}
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
