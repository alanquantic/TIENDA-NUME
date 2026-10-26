import type { Order } from '../db/schema';

/** Pago de prueba: pasarela en modo sandbox o compra simulada (SIMULATE_PAYMENTS). */
export function isTestPayment(order: Pick<Order, 'metadata' | 'externalPaymentIntentId'>): boolean {
  const metadata = order.metadata as { paymentMode?: string } | null;
  return metadata?.paymentMode === 'sandbox' || !!order.externalPaymentIntentId?.startsWith('SIMULADO-');
}
