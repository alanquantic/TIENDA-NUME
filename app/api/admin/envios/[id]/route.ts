import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { shippingRates } from '@/lib/db/schema';
import { adminShippingRateSchema } from '@/lib/validation';

export const runtime = 'nodejs';

type Params = { params: { id: string } };

export async function PUT(req: Request, { params }: Params) {
  const parsed = adminShippingRateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos.', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const updated = await db
    .update(shippingRates)
    .set({
      name: d.name,
      countries: Array.from(new Set(d.countries)),
      amount: d.amount,
      freeOverAmount: d.freeOverAmount ? d.freeOverAmount : null,
      isActive: d.isActive,
      sortOrder: d.sortOrder,
    })
    .where(eq(shippingRates.id, params.id))
    .returning({ id: shippingRates.id });

  if (updated.length === 0) {
    return NextResponse.json({ error: 'Tarifa no encontrada.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

/** Los pedidos guardan el nombre del envío como texto, así que borrar es seguro. */
export async function DELETE(_req: Request, { params }: Params) {
  const deleted = await db
    .delete(shippingRates)
    .where(eq(shippingRates.id, params.id))
    .returning({ id: shippingRates.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: 'Tarifa no encontrada.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
