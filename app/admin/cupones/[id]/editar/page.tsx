import { notFound } from 'next/navigation';
import { asc, eq, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { discountCodes, products } from '@/lib/db/schema';
import { CouponForm, type CouponFormValues } from '@/components/admin/coupon-form';

export const dynamic = 'force-dynamic';

export default async function EditarCuponPage({ params }: { params: { id: string } }) {
  const [coupon] = await db
    .select()
    .from(discountCodes)
    .where(eq(discountCodes.id, params.id))
    .limit(1);
  if (!coupon) notFound();

  // Productos activos, más el del cupón aunque ya no esté activo.
  const productList = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(
      coupon.productId
        ? or(eq(products.status, 'active'), eq(products.id, coupon.productId))
        : eq(products.status, 'active'),
    )
    .orderBy(asc(products.name));

  const initialValues: CouponFormValues = {
    id: coupon.id,
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    scope: coupon.scope,
    productId: coupon.productId,
    minSubtotal: coupon.minSubtotal,
    maxRedemptions: coupon.maxRedemptions,
    maxRedemptionsPerEmail: coupon.maxRedemptionsPerEmail,
    // Se guardó como medianoche UTC del día elegido (input type="date").
    expiresAt: coupon.expiresAt ? coupon.expiresAt.toISOString().slice(0, 10) : null,
    isActive: coupon.isActive,
    timesRedeemed: coupon.timesRedeemed,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Editar cupón {coupon.code}</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Usado {coupon.timesRedeemed} {coupon.timesRedeemed === 1 ? 'vez' : 'veces'}.
        </p>
      </div>
      <CouponForm products={productList} initialValues={initialValues} />
    </div>
  );
}
