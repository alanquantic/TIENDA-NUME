import type { Metadata } from 'next';
import Link from 'next/link';
import { CartRestore } from '@/components/cart-restore';
import { getCartForRecovery } from '@/lib/abandoned-carts';
import type { CartItem } from '@/lib/cart-store';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Recuperar carrito', robots: { index: false } };

export default async function RecoverCartPage({ params }: { params: { token: string } }) {
  const cart = await getCartForRecovery(params.token);
  const items = (cart?.items ?? []) as CartItem[];

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      {cart && items.length > 0 ? (
        <CartRestore token={cart.token} items={items} />
      ) : (
        <>
          <h1 className="mb-2 text-2xl font-semibold">No encontramos tu carrito</h1>
          <p className="mb-6 text-[hsl(var(--muted-foreground))]">
            El enlace ya no es válido. Puedes armar tu compra de nuevo desde la tienda.
          </p>
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-lg bg-[hsl(var(--primary))] px-5 text-sm font-semibold text-white hover:opacity-90"
          >
            Ir a la tienda
          </Link>
        </>
      )}
    </div>
  );
}
