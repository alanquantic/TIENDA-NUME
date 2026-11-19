import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Carrito', robots: { index: false } };

export default function CartPage() {
  redirect('/?carrito=1');
}
