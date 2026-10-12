import { NextResponse } from 'next/server';
import { capturePpOrder, getPpOrder, verifyPpWebhook } from '@/lib/payments/paypal';
import { completeOrderPayment, PaymentMismatchError } from '@/lib/payments/complete';
import { markWebhookEvent, recordWebhookEvent } from '@/lib/payments/webhook-log';
import type { PaymentMode } from '@/lib/payments/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PpEvent = {
  id: string;
  event_type: string;
  resource?: {
    id?: string;
    supplementary_data?: { related_ids?: { order_id?: string } };
  };
};

/**
 * Webhook de PayPal (respaldo del retorno del cliente).
 * Configura en PayPal la URL con `?mode=sandbox|production`. El estado del pago
 * siempre se consulta en la API; el contenido del aviso no se usa como verdad.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const mode: PaymentMode = url.searchParams.get('mode') === 'production' ? 'production' : 'sandbox';
  const event = (await req.json().catch(() => null)) as PpEvent | null;
  if (!event?.id || !event.event_type) {
    return NextResponse.json({ error: 'Evento inválido.' }, { status: 400 });
  }

  try {
    if ((await verifyPpWebhook(mode, req.headers, event)) === false) {
      console.error('[webhook paypal] firma inválida', event.id);
      return NextResponse.json({ error: 'Firma inválida.' }, { status: 401 });
    }
  } catch (err) {
    console.error('[webhook paypal] no se pudo verificar la firma', err);
    return NextResponse.json({ error: 'No se pudo verificar.' }, { status: 500 });
  }

  // Orden de PayPal relacionada con el evento.
  let paypalOrderId: string | undefined;
  if (event.event_type === 'CHECKOUT.ORDER.APPROVED') paypalOrderId = event.resource?.id;
  if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
    paypalOrderId = event.resource?.supplementary_data?.related_ids?.order_id;
  }
  if (!paypalOrderId) return NextResponse.json({ received: true, ignored: true });

  const rowId = await recordWebhookEvent('paypal', event.id, event.event_type, event);
  if (!rowId) return NextResponse.json({ received: true, duplicate: true });

  let orderId: string | null = null;
  try {
    // Aprobada pero sin capturar (el cliente cerró antes de volver): se captura aquí.
    const capture =
      event.event_type === 'CHECKOUT.ORDER.APPROVED'
        ? await capturePpOrder(mode, paypalOrderId)
        : await getPpOrder(mode, paypalOrderId);
    orderId = capture.orderId;

    if (capture.status === 'COMPLETED' && capture.captureId && orderId) {
      await completeOrderPayment(orderId, {
        paymentId: capture.captureId,
        amount: capture.amount ?? '0',
        currency: capture.currency ?? '',
      });
    }
    await markWebhookEvent(rowId, { orderId });
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[webhook paypal] error al procesar', event.id, err);
    await markWebhookEvent(rowId, { orderId, error: err });
    const status = err instanceof PaymentMismatchError ? 200 : 500;
    return NextResponse.json({ error: 'No se pudo procesar.' }, { status });
  }
}
