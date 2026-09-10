'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { cartItemToGaItem, inferCurrency, itemsValue, track } from '@/lib/analytics';
import { itemCap, useCart } from '@/lib/cart-store';
import { useToast } from '@/lib/toast-store';
import { formatMoney, toMinor } from '@/lib/money';

export function CartView() {
  const { items, setQuantity, remove, reconcile } = useCart();
  const show = useToast((s) => s.show);
  const [mounted, setMounted] = useState(false);
  const viewFired = useRef(false);
  useEffect(() => {
    setMounted(true);
    reconcile().then(({ removed, remapped }) => {
      if (removed > 0) {
        show(`Se quitó ${removed} producto no disponible del carrito.`);
      } else if (remapped > 0) {
        show('Actualizamos tu carrito con el catálogo.');
      }
    });
  }, [reconcile, show]);

  // Dispara view_cart una vez cuando ya hay items y el carrito montó.
  useEffect(() => {
    if (viewFired.current || !mounted || items.length === 0) return;
    viewFired.current = true;
    const gaItems = items.map((i, idx) => cartItemToGaItem(i, idx));
    track('view_cart', {
      currency: inferCurrency(gaItems),
      value: itemsValue(gaItems),
      items: gaItems,
    });
  }, [mounted, items]);

  function handleRemove(variantId: string) {
    const item = items.find((i) => i.variantId === variantId);
    if (item) {
      const gaItem = cartItemToGaItem(item);
      track('remove_from_cart', {
        currency: item.currency,
        value: (gaItem.price ?? 0) * (gaItem.quantity ?? 1),
        items: [gaItem],
      });
    }
    remove(variantId);
  }

  if (!mounted) return null;

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[hsl(var(--border))] p-12 text-center">
        <p className="text-[hsl(var(--muted-foreground))]">Tu carrito está vacío.</p>
        <Link href="/" className="mt-4 inline-block underline underline-offset-4">
          Ver catálogo
        </Link>
      </div>
    );
  }

  const subtotalMinor = items.reduce(
    (sum, i) => sum + toMinor(i.priceAmount) * i.quantity,
    0,
  );
  const currency = items[0]?.currency ?? 'USD';

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      <ul className="lg:col-span-2 divide-y divide-[hsl(var(--border))] border border-[hsl(var(--border))] rounded-xl">
        {items.map((item) => (
          <li key={item.variantId} className="flex gap-4 p-4">
            <div className="w-20 h-20 rounded-lg bg-[hsl(var(--muted))] overflow-hidden shrink-0">
              {item.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image} alt="" className="w-full h-full object-cover" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <Link href={`/productos/${item.slug}`} className="font-medium hover:underline">
                {item.name}
              </Link>
              {item.variantName && (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  {item.variantName}
                </p>
              )}
              <p className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))] mt-1">
                {item.type === 'digital' ? 'Digital' : 'Físico'}
              </p>
              <div className="mt-2 flex items-center gap-3">
                {item.maxPerOrder === 1 ? (
                  <span className="text-sm text-[hsl(var(--muted-foreground))]">
                    1 por pedido
                  </span>
                ) : (
                  <input
                    type="number"
                    min={1}
                    max={Number.isFinite(itemCap(item)) ? itemCap(item) : 99}
                    value={item.quantity}
                    onChange={(e) => setQuantity(item.variantId, Number(e.target.value) || 1)}
                    className="w-16 rounded-lg border border-[hsl(var(--border))] bg-transparent px-2 py-1"
                  />
                )}
                <button
                  onClick={() => handleRemove(item.variantId)}
                  className="text-sm text-red-500 hover:underline"
                >
                  Quitar
                </button>
              </div>
            </div>
            <div className="font-semibold whitespace-nowrap">
              {formatMoney(toMinor(item.priceAmount) * item.quantity, item.currency)}
            </div>
          </li>
        ))}
      </ul>

      <aside className="h-fit border border-[hsl(var(--border))] rounded-xl p-6 space-y-4">
        <div className="flex justify-between">
          <span className="text-[hsl(var(--muted-foreground))]">Subtotal</span>
          <span className="font-semibold">{formatMoney(subtotalMinor, currency)}</span>
        </div>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Envío e impuestos se calculan en el checkout.
        </p>
        <Link
          href="/checkout"
          className="block text-center rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-5 py-3.5 text-lg font-semibold"
        >
          Proceder al pago
        </Link>
      </aside>
    </div>
  );
}
