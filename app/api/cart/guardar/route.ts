import { NextResponse } from 'next/server';
import { saveCart, saveCartSchema } from '@/lib/abandoned-carts';

export const runtime = 'nodejs';

/**
 * Guarda el carrito del checkout en cuanto hay un correo válido, para poder
 * recordárselo al cliente si no termina la compra (carrito abandonado).
 */
export async function POST(req: Request) {
  const parsed = saveCartSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  }
  try {
    const token = await saveCart(parsed.data);
    return NextResponse.json({ token });
  } catch (err) {
    console.error('[cart/guardar] no se pudo guardar el carrito', err);
    return NextResponse.json({ error: 'No se pudo guardar el carrito.' }, { status: 500 });
  }
}
