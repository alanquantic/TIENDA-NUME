import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { discountCodes } from '@/lib/db/schema';
import { adminCouponSchema } from '@/lib/validation';
import { z } from 'zod';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

const emailLimitSchema = z.object({
  id: z.string().uuid(),
  maxRedemptionsPerEmail: z.number().int().positive().max(2147483647).nullable(),
});

export async function PATCH(req: Request) {
  const parsed = emailLimitSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'El límite debe ser un entero positivo o quedar vacío.' }, { status: 400 });
  const [row] = await db.update(discountCodes)
    .set({ maxRedemptionsPerEmail: parsed.data.maxRedemptionsPerEmail })
    .where(eq(discountCodes.id, parsed.data.id)).returning({ id: discountCodes.id });
  return row ? NextResponse.json(row) : NextResponse.json({ error: 'Cupón no encontrado.' }, { status: 404 });
}

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
      scope: d.scope,
      productId: d.scope === 'product' ? (d.productId || null) : null,
      minSubtotal: d.minSubtotal ? d.minSubtotal : null,
      maxRedemptions: d.maxRedemptions ?? null,
      maxRedemptionsPerEmail: d.maxRedemptionsPerEmail ?? null,
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
