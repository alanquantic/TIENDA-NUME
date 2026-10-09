import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shippingRates } from '@/lib/db/schema';
import { adminShippingRateSchema } from '@/lib/validation';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const parsed = adminShippingRateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos.', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const [row] = await db
    .insert(shippingRates)
    .values({
      name: d.name,
      countries: Array.from(new Set(d.countries)),
      amount: d.amount,
      freeOverAmount: d.freeOverAmount ? d.freeOverAmount : null,
      isActive: d.isActive,
      sortOrder: d.sortOrder,
    })
    .returning({ id: shippingRates.id });

  return NextResponse.json({ id: row.id });
}
