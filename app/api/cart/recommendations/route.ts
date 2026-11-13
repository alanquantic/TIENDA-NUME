import { NextResponse } from 'next/server';
import { listProducts } from '@/lib/queries';
import { selectCartRecommendations } from '@/lib/cart-recommendations';
import { getAvailablePaymentMethods } from '@/lib/payments/settings';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  // Acepta ?slug=a&slug=b&... o ?slug=a,b,c para considerar todo el carrito.
  const slugs = [
    ...url.searchParams.getAll('slug'),
    ...(url.searchParams.get('slugs') ?? '').split(',').filter(Boolean),
  ]
    .map((value) => value.trim())
    .filter((value, index, arr) => value && arr.indexOf(value) === index);

  const [catalog, methods] = await Promise.all([
    slugs.length ? listProducts() : Promise.resolve([]),
    getAvailablePaymentMethods(),
  ]);

  // selectCartRecommendations excluye los productos y categorías ya presentes
  // en el carrito, y elige una sola sugerencia por categoría nueva.
  const products = selectCartRecommendations(catalog, slugs, 8);

  return NextResponse.json({
    products,
    paymentMethods: methods.map(({ method, label }) => ({ method, label })),
  });
}
