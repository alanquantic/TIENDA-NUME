'use client';

import { useEffect } from 'react';
import { useCart } from '@/lib/cart-store';

/** Vacía el carrito al montar (tras un pago exitoso). */
export function ClearCart() {
  const clear = useCart((s) => s.clear);
  useEffect(() => {
    clear();
  }, [clear]);
  return null;
}
