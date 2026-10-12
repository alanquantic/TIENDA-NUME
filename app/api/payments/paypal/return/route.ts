import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { capturePpOrder } from '@/lib/payments/paypal';
import { completeOrderPayment } from '@/lib/payments/complete';
import type { PaymentMode } from '@/lib/payments/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Retorno desde PayPal tras aprobar el pago (`return_url` de la orden).
 * Captura el cobro y manda al cliente a la página de éxito. El webhook de
 * PayPal hace lo mismo como respaldo si el cliente cierra la ventana.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderId = url.searchParams.get('order');
  const paypalOrderId = url.searchParams.get('token');
  const redirect = (path: string) => NextResponse.redirect(new URL(path, url.origin));

  if (!orderId || !paypalOrderId) return redirect('/checkout/cancel');

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  // El token debe ser la orden de PayPal que se creó para este pedido.
  if (!order || order.provider !== 'paypal' || order.externalCheckoutId !== paypalOrderId) {
    return redirect('/checkout/cancel');
  }

  if (order.status === 'pending') {
    const mode: PaymentMode =
      (order.metadata as { paymentMode?: string })?.paymentMode === 'production'
        ? 'production'
        : 'sandbox';
    try {
      const capture = await capturePpOrder(mode, paypalOrderId);
      if (capture.status !== 'COMPLETED' || !capture.captureId) {
        console.error('[paypal/return] captura no completada', orderId, capture.status);
        return redirect(`/checkout/cancel?order=${orderId}`);
      }
      await completeOrderPayment(orderId, {
        paymentId: capture.captureId,
        amount: capture.amount ?? '0',
        currency: capture.currency ?? '',
      });
    } catch (err) {
      console.error('[paypal/return] error al capturar', orderId, err);
      return redirect(`/checkout/cancel?order=${orderId}`);
    }
  }

  return redirect(`/checkout/success?order=${orderId}`);
}
