'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCart } from '@/lib/cart-store';
import { config } from '@/lib/config';
import { ThemeToggle } from '@/components/theme-toggle';

export function SiteHeader() {
  const items = useCart((s) => s.items);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const count = mounted ? items.reduce((n, i) => n + i.quantity, 0) : 0;

  return (
    <header className="border-b border-[hsl(var(--border))] sticky top-0 z-20 bg-[hsl(var(--card))]/90 backdrop-blur">
      <div className="w-full px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="font-semibold text-lg tracking-tight shrink-0">
          {config.storeName}
        </Link>
        <nav className="flex items-center gap-2 sm:gap-4 text-sm">
          <Link href="/" className="hidden sm:inline hover:opacity-70 px-2">
            Catálogo
          </Link>
          <ThemeToggle />
          <Link
            href="/carrito"
            className="relative inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] px-3 h-9 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <span className="hidden sm:inline">Carrito</span>
            {count > 0 && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-xs font-semibold bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]">
                {count}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}
