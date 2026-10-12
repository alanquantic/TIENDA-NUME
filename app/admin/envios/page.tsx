import { asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { shippingRates } from '@/lib/db/schema';
import { formatDecimal } from '@/lib/money';
import { config } from '@/lib/config';
import { ShippingRatesManager } from '@/components/admin/shipping-rates-manager';

export const dynamic = 'force-dynamic';

export default async function AdminShipping() {
  const rows = await db
    .select()
    .from(shippingRates)
    .orderBy(asc(shippingRates.sortOrder), asc(shippingRates.createdAt));

  const rates = rows.map((r) => ({
    id: r.id,
    name: r.name,
    countries: (r.countries as string[]) ?? [],
    amount: r.amount,
    freeOverAmount: r.freeOverAmount,
    isActive: r.isActive,
    sortOrder: r.sortOrder,
  }));

  const formatAmount = Object.fromEntries(
    rows.map((r) => [
      r.id,
      {
        amount: parseFloat(r.amount) === 0 ? 'Gratis' : formatDecimal(r.amount, config.currency),
        free: r.freeOverAmount ? formatDecimal(r.freeOverAmount, config.currency) : null,
      },
    ]),
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Envíos</h1>
        <p className="max-w-2xl text-sm text-[hsl(var(--muted-foreground))]">
          Tarifa fija por zona. En el checkout, el cliente ve las tarifas activas que aplican al
          país de su dirección y elige una. Solo se cobra envío si el pedido tiene productos
          físicos.
        </p>
      </div>
      <ShippingRatesManager rates={rates} formatAmount={formatAmount} />
    </div>
  );
}
