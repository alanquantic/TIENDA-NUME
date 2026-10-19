import { NextResponse } from 'next/server';
import { getProductBySlug, getRelatedProducts } from '@/lib/queries';
import { getAvailablePaymentMethods } from '@/lib/payments/settings';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get('slug');
  const [data, methods] = await Promise.all([
    slug ? getProductBySlug(slug) : null,
    getAvailablePaymentMethods(),
  ]);
  const products = data ? await getRelatedProducts(data.product.categoryId, data.product.id, 8) : [];
  return NextResponse.json({
    products,
    paymentMethods: methods.map(({ method, label }) => ({ method, label })),
  });
}
