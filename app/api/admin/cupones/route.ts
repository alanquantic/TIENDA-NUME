import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { discountCodes } from '@/lib/db/schema';
import { adminCouponSchema } from '@/lib/validation';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = adminCouponSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos.', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const [row] = await db
    .insert(discountCodes)
    .values({
      code: d.code.trim().toUpperCase(),
      type: d.type,
      value: d.value,
      minSubtotal: d.minSubtotal ? d.minSubtotal : null,
      maxRedemptions: d.maxRedemptions ?? null,
      expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
      isActive: d.isActive,
    })
    .onConflictDoNothing({ target: discountCodes.code })
    .returning();

  if (!row) {
    return NextResponse.json({ error: 'Ya existe un cupón con ese código.' }, { status: 409 });
  }
  return NextResponse.json({ id: row.id, code: row.code });
}
