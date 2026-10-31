import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { products } from '@/lib/db/schema';
import { hasAgendaPresaleEnded, withoutAgendaPresale } from '@/lib/agenda-presale';
import { AGENDA_2027_PRODUCT_ID } from '@/lib/order-limits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Corrida única (Vercel Cron, ver vercel.json): quita la preventa del nombre y la
 * descripción de la Agenda 2027. Antes de la fecha no hace nada y repetirla no
 * cambia el producto.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret && process.env.VERCEL_ENV) {
    console.error('[cron] CRON_SECRET no está configurado; se rechaza la corrida.');
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  if (secret && !safeEqual(req.headers.get('authorization') ?? '', `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  if (!hasAgendaPresaleEnded()) {
    return NextResponse.json({ ok: true, actualizado: false, nota: 'la preventa sigue vigente' });
  }

  const [product] = await db
    .select({ name: products.name, description: products.description })
    .from(products)
    .where(eq(products.id, AGENDA_2027_PRODUCT_ID));
  if (!product) {
    console.error('[cron] No se encontró la Agenda 2027.');
    return NextResponse.json({ error: 'Producto no encontrado.' }, { status: 404 });
  }

  const next = withoutAgendaPresale(product);
  if (next.name === product.name && next.description === product.description) {
    return NextResponse.json({ ok: true, actualizado: false, nota: 'ya estaba actualizado' });
  }

  await db
    .update(products)
    .set({ ...next, updatedAt: new Date() })
    .where(eq(products.id, AGENDA_2027_PRODUCT_ID));
  console.log('[cron] Preventa de la Agenda 2027 retirada.');
  return NextResponse.json({ ok: true, actualizado: true, nombre: next.name });
}
