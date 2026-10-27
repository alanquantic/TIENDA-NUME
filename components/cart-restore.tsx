'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCart, writeCartToken, type CartItem } from '@/lib/cart-store';

/** Rearma el carrito guardado y lleva al checkout. */
export function CartRestore({ token, items }: { token: string; items: CartItem[] }) {
  const router = useRouter();

  useEffect(() => {
    const cart = useCart.getState();
    cart.restore(items);
    writeCartToken(token);
    // Ajusta precios, stock o productos retirados antes de pagar.
    cart.reconcile().finally(() => router.replace('/checkout'));
  }, [items, router, token]);

  return (
    <p role="status" className="text-[hsl(var(--muted-foreground))]">
      Recuperando tu carrito…
    </p>
  );
}
