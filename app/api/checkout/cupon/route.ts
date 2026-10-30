import { NextResponse } from 'next/server';
import { z } from 'zod';
import { previewDiscount, PricingError } from '@/lib/pricing';
import { checkoutLineSchema } from '@/lib/validation';

export const runtime = 'nodejs';

const schema = z.object({
  code: z.string().trim().min(1, 'Escribe un código.'),
  email: z.string().trim().email().optional(),
  items: z.array(checkoutLineSchema).min(1),
});

/**
 * Valida un cupón contra el carrito y devuelve el descuento, para mostrarlo
 * antes de pagar. El cobro lo vuelve a calcular en /api/checkout.
 */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Escribe un código de cupón.' }, { status: 400 });
  }

  try {
    const { code, amountMinor } = await previewDiscount(parsed.data.items, parsed.data.code, parsed.data.email);
    return NextResponse.json({ code, discountMinor: amountMinor });
  } catch (err) {
    if (err instanceof PricingError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error('[checkout/cupon] error al validar el cupón', err);
    return NextResponse.json({ error: 'No se pudo validar el cupón.' }, { status: 500 });
  }
}
