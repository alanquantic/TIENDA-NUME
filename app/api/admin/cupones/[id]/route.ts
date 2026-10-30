import { NextResponse } from 'next/server';
import { and, eq, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { discountCodes } from '@/lib/db/schema';
import { adminCouponSchema } from '@/lib/validation';

export const runtime = 'nodejs';

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const body = await req.json().catch(() => null);
  const parsed = adminCouponSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos inválidos.', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const code = d.code.trim().toUpperCase();

  const [existing] = await db
    .select()
    .from(discountCodes)
    .where(eq(discountCodes.id, params.id))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: 'Cupón no encontrado.' }, { status: 404 });
  }

  // Los usos por correo se cuentan por código en los pedidos: renombrar un
  // cupón ya usado reiniciaría el contador de cada cliente.
  if (code !== existing.code && existing.timesRedeemed > 0) {
    return NextResponse.json(
      { error: `El cupón ya se usó ${existing.timesRedeemed} vez/veces; su código no se puede cambiar.` },
      { status: 409 },
    );
  }

  const [clash] = await db
    .select({ id: discountCodes.id })
    .from(discountCodes)
    .where(and(eq(discountCodes.code, code), ne(discountCodes.id, existing.id)))
    .limit(1);
  if (clash) {
    return NextResponse.json({ error: 'Ya existe un cupón con ese código.' }, { status: 409 });
  }

  await db
    .update(discountCodes)
    .set({
      code,
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
    .where(eq(discountCodes.id, existing.id));

  return NextResponse.json({ id: existing.id, code });
}
