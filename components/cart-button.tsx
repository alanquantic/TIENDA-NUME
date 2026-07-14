'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCart } from '@/lib/cart-store';
import { CartIcon } from '@/components/ui/icons';

export function CartButton({ className }: { className?: string }) {
  const items = useCart((s) => s.items);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const count = mounted ? items.reduce((n, i) => n + i.quantity, 0) : 0;

  return (
    <Link
      href="/carrito"
      className={
        className ??
        'header-chip inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-gradient-brand px-4 py-2 text-sm font-semibold text-white shadow-glow hover:opacity-95'
      }
    >
      <CartIcon width={18} height={18} className="relative z-10" />
      <span className="relative z-10 hidden sm:inline">Carrito</span>
      {count > 0 && (
        <span className="relative z-10 inline-flex min-w-5 items-center justify-center rounded-full bg-white/25 px-1.5 text-xs font-bold">
          {count}
        </span>
      )}
    </Link>
  );
}
