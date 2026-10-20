'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useCartDrawer } from '@/lib/cart-drawer-store';
import { useCart } from '@/lib/cart-store';
import { useUpsell } from '@/lib/upsell-store';
import type { CatalogCard } from '@/lib/queries';
import { CartView } from '@/components/cart-view';
import { CartRecommendations } from '@/components/cart-recommendations';
import { ProductTrust } from '@/components/product-trust';
import Link from 'next/link';

export function CartDrawer() {
  const { isOpen, open, close } = useCartDrawer();
  const items = useCart((s) => s.items);
  const offer = useUpsell((s) => s.offer);
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const [recommendations, setRecommendations] = useState<CatalogCard[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<{ method: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const slug = items[items.length - 1]?.slug;

  useEffect(() => {
    // Los enlaces antiguos a /carrito abren el mismo panel sobre el catálogo.
    const url = new URL(window.location.href);
    if (url.searchParams.get('carrito') === '1') {
      open();
      url.searchParams.delete('carrito');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
      previousPath.current = pathname;
      return;
    }
    if (previousPath.current !== pathname) close();
    previousPath.current = pathname;
  }, [pathname, open, close]);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (!isOpen) {
      element.close();
      return;
    }
    element.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    setRecommendations([]);
    fetch(`/api/cart/recommendations${slug ? `?slug=${encodeURIComponent(slug)}` : ''}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('No disponible');
        return response.json();
      })
      .then((data: { products: CatalogCard[]; paymentMethods: { method: string; label: string }[] }) => {
        setRecommendations(data.products);
        setPaymentMethods(data.paymentMethods);
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [isOpen, slug]);

  const related = recommendations.filter((product) => !items.some((item) => item.productId === product.id));
  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="cart-drawer-title"
      onCancel={close}
      onClose={close}
      onClick={(event) => {
        if (event.target === dialog.current) close();
        if ((event.target as HTMLElement).closest('a[href]')) close();
      }}
      className="cart-drawer m-0 ml-auto h-[100dvh] max-h-none w-[80vw] max-w-lg border-0 bg-[hsl(var(--background))] p-0 text-[hsl(var(--foreground))] shadow-2xl backdrop:bg-black/45 backdrop:backdrop-blur-sm sm:w-full"
    >
      {isOpen && <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-[hsl(var(--border))] px-4 py-4 sm:px-6">
          <h2 id="cart-drawer-title" className="text-xl font-semibold">Tu carrito <span className="ml-2 rounded-full bg-[hsl(var(--primary-soft))] px-2 py-1 text-sm text-[hsl(var(--primary))]">{count}</span></h2>
          <button type="button" onClick={close} aria-label="Cerrar carrito" className="grid h-10 w-10 place-items-center rounded-full text-2xl hover:bg-[hsl(var(--muted))]">×</button>
        </header>
        <CartView>
          {offer && <div className="mt-3 rounded-xl border border-[hsl(var(--accent))] p-4 text-sm">
            <p>¿Buscabas la agenda más reciente?</p>
            <Link href={offer.href} className="mt-2 inline-block font-semibold text-[hsl(var(--primary))] underline">Ver {offer.name} →</Link>
          </div>}
          {loading ? <div role="status" className="mt-2 rounded-2xl bg-[hsl(var(--primary-soft))] p-4">
            <p className="text-base font-semibold">Te puede interesar</p>
            <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Buscando productos relacionados…</p>
          </div> : failed ? <Link href="/" className="my-4 inline-block text-sm underline">Explorar el catálogo</Link> : <CartRecommendations key={slug} products={related} />}
          <div className="pb-5"><ProductTrust type={items.some((item) => item.type === 'physical') ? 'physical' : 'digital'} paymentMethods={paymentMethods} /></div>
        </CartView>
      </div>}
    </dialog>
  );
}
