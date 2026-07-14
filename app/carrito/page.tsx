import type { Metadata } from 'next';
import { CartView } from '@/components/cart-view';

export const metadata: Metadata = { title: 'Carrito' };

export default function CartPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight mb-8">Carrito</h1>
      <CartView />
    </div>
  );
}
