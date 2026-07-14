import { desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { discountCodes } from '@/lib/db/schema';
import { formatDecimal } from '@/lib/money';
import { config } from '@/lib/config';
import { CouponForm } from '@/components/admin/coupon-form';

export const dynamic = 'force-dynamic';

const fmtDate = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' });

export default async function AdminCoupons() {
  const rows = await db.select().from(discountCodes).orderBy(desc(discountCodes.createdAt));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Cupones</h1>

      {rows.length > 0 && (
        <div className="overflow-x-auto border border-[hsl(var(--border))] rounded-xl">
          <table className="w-full text-sm">
            <thead className="text-left text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))]">
              <tr>
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Descuento</th>
                <th className="px-4 py-3 font-medium">Usos</th>
                <th className="px-4 py-3 font-medium">Expira</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium">{c.code}</td>
                  <td className="px-4 py-3">
                    {c.type === 'percent'
                      ? `${parseFloat(c.value)}%`
                      : formatDecimal(c.value, config.currency)}
                    {c.minSubtotal
                      ? ` (mín. ${formatDecimal(c.minSubtotal, config.currency)})`
                      : ''}
                  </td>
                  <td className="px-4 py-3">
                    {c.timesRedeemed}
                    {c.maxRedemptions != null ? ` / ${c.maxRedemptions}` : ''}
                  </td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                    {c.expiresAt ? fmtDate.format(c.expiresAt) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={c.isActive ? 'text-green-600' : 'text-[hsl(var(--muted-foreground))]'}>
                      {c.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CouponForm />
    </div>
  );
}
