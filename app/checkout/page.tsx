import type { Metadata } from 'next';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { products, shippingRates } from '@/lib/db/schema';
import { config } from '@/lib/config';
import { CheckoutForm, type ShippingRateDTO } from '@/components/checkout-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Checkout' };

export default async function CheckoutPage() {
  const [rates, physicalProducts] = await Promise.all([
    db
      .select()
      .from(shippingRates)
      .where(eq(shippingRates.isActive, true))
      .orderBy(asc(shippingRates.sortOrder)),
    db
      .select({ slug: products.slug })
      .from(products)
      .where(and(eq(products.status, 'active'), eq(products.type, 'physical'))),
  ]);

  const dto: ShippingRateDTO[] = rates.map((r) => ({
    id: r.id,
    name: r.name,
    amount: r.amount,
    freeOverAmount: r.freeOverAmount,
    countries: (r.countries as string[]) ?? [],
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight mb-8">Checkout</h1>
      <CheckoutForm
        shippingRates={dto}
        physicalProductSlugs={physicalProducts.map((product) => product.slug)}
        currency={config.currency}
        simulate={config.simulatePayments}
      />
    </div>
  );
}
