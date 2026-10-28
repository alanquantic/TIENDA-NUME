import 'server-only';
import { randomBytes } from 'node:crypto';
import { and, asc, eq, gt, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { config } from './config';
import { db } from './db';
import { abandonedCarts, orders, type AbandonedCart, type Order } from './db/schema';
import { sendCartRecovery } from './email';
import { fromMinorToDecimalString } from './money';
import { priceLines } from './pricing';

/** Sin actividad este tiempo, el carrito se da por abandonado y se avisa. */
const ABANDON_AFTER_MS = 60 * 60 * 1000;
/** Carritos más viejos ya no reciben correo (llegaría fuera de contexto). */
const NOTIFY_WITHIN_MS = 48 * 60 * 60 * 1000;
/** Una compra dentro de esta ventana cuenta como recuperación del carrito. */
const ATTRIBUTION_MS = 14 * 24 * 60 * 60 * 1000;
const BATCH = 25;

export const CART_TOKEN_RE = /^[a-f0-9]{48}$/;

// Snapshot del carrito del navegador (CartItem). Solo se usa para mostrarlo y
// rearmarlo; los precios se recalculan siempre en el checkout.
const cartItemSchema = z.object({
  variantId: z.string().uuid(),
  productId: z.string().uuid(),
  slug: z.string().max(200),
  name: z.string().max(300),
  variantName: z.string().max(200).nullable(),
  priceAmount: z.string().max(20),
  currency: z.string().max(3),
  image: z.string().max(1000).nullable(),
  type: z.enum(['digital', 'physical']),
  quantity: z.number().int().min(1).max(99),
  maxStock: z.number().int().nullable(),
  maxPerOrder: z.number().int().nullable().optional(),
});

export const saveCartSchema = z.object({
  token: z.string().regex(CART_TOKEN_RE).nullish(),
  email: z.string().trim().email().max(254),
  firstName: z.string().trim().max(120).nullish(),
  items: z.array(cartItemSchema).min(1).max(30),
});

export type SavedCartItem = z.infer<typeof cartItemSchema>;

export function cartRecoveryUrl(token: string): string {
  return `${config.appUrl}/carrito/recuperar/${token}`;
}

/**
 * Guarda (o actualiza) el carrito del checkout. Devuelve el token que el
 * navegador conserva para seguir actualizando la misma fila.
 */
export async function saveCart(input: z.infer<typeof saveCartSchema>): Promise<string> {
  let subtotal: string | null = null;
  let currency: string | null = null;
  try {
    const priced = await priceLines(input.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })));
    subtotal = fromMinorToDecimalString(priced.subtotalMinor);
    currency = priced.currency ?? config.currency;
  } catch {
    // Sin stock o producto retirado: se guarda igual, sin monto.
  }

  const values = {
    email: input.email.toLowerCase(),
    firstName: input.firstName || null,
    items: input.items,
    subtotalAmount: subtotal,
    currency,
    updatedAt: new Date(),
  };

  if (input.token) {
    // Solo se actualiza un carrito que sigue abierto; uno ya comprado o avisado
    // empieza fila nueva (es otra intención de compra).
    const [row] = await db
      .update(abandonedCarts)
      .set(values)
      .where(and(eq(abandonedCarts.token, input.token), eq(abandonedCarts.status, 'open')))
      .returning({ token: abandonedCarts.token });
    if (row) return row.token;
  }

  const token = randomBytes(24).toString('hex');
  await db.insert(abandonedCarts).values({ ...values, token });
  return token;
}

/** El checkout creó un pedido desde este carrito (aún sin pagar). */
export async function linkCartToOrder(token: string | null | undefined, orderId: string): Promise<void> {
  if (!token || !CART_TOKEN_RE.test(token)) return;
  await db
    .update(abandonedCarts)
    .set({ orderId })
    .where(and(eq(abandonedCarts.token, token), inArray(abandonedCarts.status, ['open', 'notified'])));
}

/**
 * Al pagarse un pedido, cierra los carritos de ese cliente: 'recovered' si se
 * le había mandado el correo de recuperación, 'converted' si compró sin él.
 */
export async function markCartPurchased(order: Pick<Order, 'id' | 'customerEmail' | 'totalAmount'>): Promise<void> {
  const now = new Date();
  await db
    .update(abandonedCarts)
    .set({
      status: sql`case when ${abandonedCarts.notifiedAt} is null then 'converted' else 'recovered' end`,
      purchasedAt: now,
      purchasedOrderId: order.id,
      purchasedAmount: order.totalAmount,
      updatedAt: now,
    })
    .where(
      and(
        inArray(abandonedCarts.status, ['open', 'notified']),
        or(
          eq(abandonedCarts.orderId, order.id),
          and(
            eq(abandonedCarts.email, order.customerEmail.toLowerCase()),
            gt(abandonedCarts.updatedAt, new Date(now.getTime() - ATTRIBUTION_MS)),
          ),
        ),
      ),
    );
}

/** El cliente abrió el enlace del correo. */
export async function getCartForRecovery(token: string): Promise<AbandonedCart | null> {
  if (!CART_TOKEN_RE.test(token)) return null;
  const [row] = await db
    .update(abandonedCarts)
    .set({ clickedAt: sql`coalesce(${abandonedCarts.clickedAt}, now())` })
    .where(eq(abandonedCarts.token, token))
    .returning();
  return row ?? null;
}

/** Carrito ligado a un pedido, para poner su enlace en el correo de pago fallido. */
export async function cartForOrder(orderId: string): Promise<AbandonedCart | null> {
  const [row] = await db
    .select()
    .from(abandonedCarts)
    .where(and(eq(abandonedCarts.orderId, orderId), inArray(abandonedCarts.status, ['open', 'notified'])))
    .limit(1);
  return row ?? null;
}

export async function markCartNotified(id: string): Promise<void> {
  await db
    .update(abandonedCarts)
    .set({ status: 'notified', notifiedAt: new Date() })
    .where(and(eq(abandonedCarts.id, id), eq(abandonedCarts.status, 'open')));
}

/** ¿El correo compró algo después de armar el carrito? Entonces no se le escribe. */
async function boughtSince(email: string, since: Date): Promise<boolean> {
  const [row] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        sql`lower(${orders.customerEmail}) = ${email}`,
        gt(orders.createdAt, since),
        inArray(orders.status, ['paid', 'fulfilled']),
      ),
    )
    .limit(1);
  return !!row;
}

/**
 * Manda el correo de recuperación a los carritos abiertos con más de una hora
 * sin actividad. Los que llegaron a crear pedido los cubre el aviso de pago no
 * completado (expire.ts), que lleva el mismo enlace. Lo corre el cron horario.
 */
export async function notifyAbandonedCarts(): Promise<{ revisados: number; avisados: number; cerrados: number }> {
  const now = Date.now();
  const carts = await db
    .select()
    .from(abandonedCarts)
    .where(
      and(
        eq(abandonedCarts.status, 'open'),
        isNull(abandonedCarts.orderId),
        lt(abandonedCarts.updatedAt, new Date(now - ABANDON_AFTER_MS)),
        gt(abandonedCarts.updatedAt, new Date(now - NOTIFY_WITHIN_MS)),
      ),
    )
    .orderBy(asc(abandonedCarts.updatedAt))
    .limit(BATCH);

  const stats = { revisados: carts.length, avisados: 0, cerrados: 0 };
  for (const cart of carts) {
    if (await boughtSince(cart.email, cart.createdAt)) {
      await db
        .update(abandonedCarts)
        .set({ status: 'converted', updatedAt: new Date() })
        .where(eq(abandonedCarts.id, cart.id));
      stats.cerrados++;
      continue;
    }
    // Se marca antes de enviar: si el envío falla no se reintenta en bucle.
    const claimed = await db
      .update(abandonedCarts)
      .set({ status: 'notified', notifiedAt: new Date() })
      .where(and(eq(abandonedCarts.id, cart.id), eq(abandonedCarts.status, 'open')))
      .returning({ id: abandonedCarts.id });
    if (claimed.length === 0) continue;
    const items = cart.items as SavedCartItem[];
    await sendCartRecovery({
      to: cart.email,
      customerName: cart.firstName ?? '',
      items: items.map((i) => ({ name: i.name, variantName: i.variantName, quantity: i.quantity })),
      recoveryUrl: cartRecoveryUrl(cart.token),
    });
    stats.avisados++;
  }
  return stats;
}
