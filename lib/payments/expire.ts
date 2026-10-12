import { and, asc, eq, gt, lt, sql } from 'drizzle-orm';
import { db } from '../db';
import { orders, type Order } from '../db/schema';
import { notifyOrderFailed } from '../fulfillment';
import { completeOrderPayment } from './complete';
import { searchMpPaymentsForOrder } from './mercadopago';
import { capturePpOrder, getPpOrder } from './paypal';
import type { PaymentMode } from './settings';

/** Un pedido sin pago después de este tiempo se considera abandonado. */
const ABANDON_AFTER_MS = 60 * 60 * 1000;
/** Pedidos más viejos que esto se cancelan sin correo (llegaría fuera de contexto). */
const NOTIFY_WITHIN_MS = 48 * 60 * 60 * 1000;
/** Máximo de pedidos revisados por corrida del cron. */
const BATCH = 25;

type Verdict = 'paid' | 'waiting' | 'abandoned';

function modeOf(order: Order): PaymentMode {
  return (order.metadata as { paymentMode?: string })?.paymentMode === 'production'
    ? 'production'
    : 'sandbox';
}

/**
 * Pregunta a la pasarela qué pasó con el pedido antes de cancelarlo:
 * si sí se pagó (aviso perdido) se completa; si hay un pago en espera
 * (OXXO, transferencia) se respeta hasta que venza.
 */
async function checkWithGateway(order: Order): Promise<Verdict> {
  const mode = modeOf(order);

  if (order.provider === 'mercadopago') {
    const payments = await searchMpPaymentsForOrder(mode, order.id);
    const approved = payments.find((p) => p.status === 'approved');
    if (approved) {
      await completeOrderPayment(order.id, {
        paymentId: String(approved.id),
        amount: approved.transaction_amount,
        currency: approved.currency_id,
      });
      return 'paid';
    }
    const waiting = payments.some(
      (p) =>
        (p.status === 'pending' || p.status === 'in_process' || p.status === 'authorized') &&
        (!p.date_of_expiration || new Date(p.date_of_expiration) > new Date()),
    );
    return waiting ? 'waiting' : 'abandoned';
  }

  if (order.provider === 'paypal' && order.externalCheckoutId) {
    let state = await getPpOrder(mode, order.externalCheckoutId);
    // Aprobado pero nunca capturado (el cliente cerró antes de volver).
    if (state.status === 'APPROVED') state = await capturePpOrder(mode, order.externalCheckoutId);
    if (state.status === 'COMPLETED' && state.captureId) {
      await completeOrderPayment(order.id, {
        paymentId: state.captureId,
        amount: state.amount ?? '0',
        currency: state.currency ?? '',
      });
      return 'paid';
    }
    return state.status === 'PENDING' ? 'waiting' : 'abandoned';
  }

  // Pedidos de Stripe (ya retirado) u otros: no hay a quién preguntar.
  return 'abandoned';
}

/** ¿El cliente terminó pagando en otro pedido posterior? Entonces no se le avisa. */
async function paidLater(order: Order): Promise<boolean> {
  const [row] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        sql`lower(${orders.customerEmail}) = ${order.customerEmail.toLowerCase()}`,
        gt(orders.createdAt, order.createdAt),
        sql`${orders.status} in ('paid', 'fulfilled')`,
      ),
    )
    .limit(1);
  return !!row;
}

/**
 * Cancela pedidos pendientes sin pago tras 1 hora y avisa al cliente que no se
 * hizo ningún cargo. Lo corre el cron horario.
 */
export async function expireAbandonedOrders(): Promise<{
  revisados: number;
  cancelados: number;
  avisados: number;
  pagados: number;
  enEspera: number;
}> {
  const cutoff = new Date(Date.now() - ABANDON_AFTER_MS);
  const pending = await db
    .select()
    .from(orders)
    .where(and(eq(orders.status, 'pending'), lt(orders.createdAt, cutoff)))
    .orderBy(asc(orders.createdAt))
    .limit(BATCH);

  const stats = { revisados: pending.length, cancelados: 0, avisados: 0, pagados: 0, enEspera: 0 };

  for (const order of pending) {
    let verdict: Verdict;
    try {
      verdict = await checkWithGateway(order);
    } catch (err) {
      // Pasarela caída o error: no se cancela a ciegas; se reintenta la próxima hora.
      console.error('[expire] no se pudo revisar el pedido', order.number, err);
      continue;
    }

    if (verdict === 'paid') {
      stats.pagados++;
      continue;
    }
    if (verdict === 'waiting') {
      stats.enEspera++;
      continue;
    }

    const cancelled = await db
      .update(orders)
      .set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() })
      .where(and(eq(orders.id, order.id), eq(orders.status, 'pending')))
      .returning({ id: orders.id });
    if (cancelled.length === 0) continue; // se pagó mientras tanto
    stats.cancelados++;

    const recent = Date.now() - order.createdAt.getTime() < NOTIFY_WITHIN_MS;
    if (recent && !(await paidLater(order))) {
      try {
        await notifyOrderFailed(order.id);
        stats.avisados++;
      } catch (err) {
        console.error('[expire] no se pudo enviar el aviso', order.number, err);
      }
    }
  }

  return stats;
}
