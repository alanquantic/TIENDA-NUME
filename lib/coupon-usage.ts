import { and, eq, isNotNull, ne, or, sql } from 'drizzle-orm';
import type { db } from './db';
import { orders } from './db/schema';
import { PricingError } from './pricing-error';

export async function assertCouponEmailLimit(
  connection: Pick<typeof db, 'select'>,
  coupon: { code: string; maxRedemptionsPerEmail: number | null },
  email?: string,
): Promise<void> {
  if (coupon.maxRedemptionsPerEmail == null) return;
  const normalized = email?.trim().toLowerCase();
  if (!normalized) throw new PricingError('Ingresa tu correo para aplicar este cupón.');
  const [usage] = await connection.select({ count: sql<number>`count(*)::int` }).from(orders)
    .where(and(
      eq(orders.discountCode, coupon.code),
      sql`lower(trim(${orders.customerEmail})) = ${normalized}`,
      // Pending orders reserve a use. Paid/refunded orders retain their use.
      or(ne(orders.status, 'cancelled'), isNotNull(orders.paidAt)),
    ));
  if (usage.count >= coupon.maxRedemptionsPerEmail) {
    throw new PricingError('Este correo alcanzó el máximo de usos de este cupón. Si tienes un pedido pendiente, complétalo o cancélalo antes de intentar de nuevo.');
  }
}
