import { eq } from 'drizzle-orm';
import { db } from '../db';
import { orders } from '../db/schema';
import { fulfillOrder } from '../fulfillment';
import { toMinor } from '../money';
import type { PaymentMode } from './settings';

export class PaymentMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentMismatchError';
  }
}

/**
 * Marca un pedido como pagado tras confirmar el cobro con la pasarela.
 * Verifica que el monto y la moneda cobrados coincidan con el pedido antes de
 * entregar nada. Idempotente: `fulfillOrder` ignora pedidos que ya no están
 * pendientes, así que webhook y retorno del cliente pueden llamar ambos.
 */
export async function completeOrderPayment(
  orderId: string,
  payment: { paymentId: string; amount: string | number; currency: string; mode?: PaymentMode },
): Promise<void> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new PaymentMismatchError(`Pedido ${orderId} no encontrado`);

  // El modo del aviso (?mode= del webhook) lo controla quien llama: debe ser el
  // mismo con el que se creó el pedido, o un pago sandbox podría pagar uno real.
  const orderMode =
    (order.metadata as { paymentMode?: string } | null)?.paymentMode === 'production'
      ? 'production'
      : 'sandbox';
  if (payment.mode && payment.mode !== orderMode) {
    throw new PaymentMismatchError(
      `Pago en modo ${payment.mode} ≠ modo del pedido ${orderMode}`,
    );
  }

  if (payment.currency.toUpperCase() !== order.currency.toUpperCase()) {
    throw new PaymentMismatchError(
      `Moneda cobrada ${payment.currency} ≠ moneda del pedido ${order.currency}`,
    );
  }
  if (toMinor(payment.amount) !== toMinor(order.totalAmount)) {
    throw new PaymentMismatchError(
      `Monto cobrado ${payment.amount} ≠ total del pedido ${order.totalAmount}`,
    );
  }

  await fulfillOrder(orderId, { paymentIntentId: payment.paymentId });
}
