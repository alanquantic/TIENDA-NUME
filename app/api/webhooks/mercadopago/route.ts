import { NextResponse } from 'next/server';
import { getMpPayment, verifyMpSignature } from '@/lib/payments/mercadopago';
import { completeOrderPayment, PaymentMismatchError } from '@/lib/payments/complete';
import { markWebhookEvent, recordWebhookEvent } from '@/lib/payments/webhook-log';
import type { PaymentMode } from '@/lib/payments/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Avisos de Mercado Pago (notification_url de cada preferencia).
 * La URL lleva `?mode=sandbox|production` para elegir el access token.
 * Nunca se confía en el contenido del aviso: el pago se consulta en la API.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const mode: PaymentMode = url.searchParams.get('mode') === 'production' ? 'production' : 'sandbox';
  const body = (await req.json().catch(() => ({}))) as {
    type?: string;
    topic?: string;
    action?: string;
    data?: { id?: string | number };
  };

  const type = body.type ?? body.topic ?? url.searchParams.get('type') ?? url.searchParams.get('topic');
  const dataId = String(body.data?.id ?? url.searchParams.get('data.id') ?? url.searchParams.get('id') ?? '');

  // Solo interesan los pagos; otros avisos (merchant_order, etc.) se ignoran.
  if (type !== 'payment' || !dataId) {
    return NextResponse.json({ received: true, ignored: true });
  }

  if (verifyMpSignature(mode, req.headers, dataId) === false) {
    console.error('[webhook mercadopago] firma inválida para el pago', dataId);
    return NextResponse.json({ error: 'Firma inválida.' }, { status: 401 });
  }

  let payment;
  try {
    payment = await getMpPayment(mode, dataId);
  } catch (err) {
    console.error('[webhook mercadopago] no se pudo consultar el pago', dataId, err);
    // 500 → Mercado Pago reintenta.
    return NextResponse.json({ error: 'No se pudo consultar el pago.' }, { status: 500 });
  }

  // Un mismo pago avisa varias veces (pending → approved); se registra por estado.
  const rowId = await recordWebhookEvent(
    'mercadopago',
    `${payment.id}:${payment.status}`,
    `payment.${payment.status}`,
    payment,
  );
  if (!rowId) return NextResponse.json({ received: true, duplicate: true });

  const orderId = payment.external_reference;
  if (payment.status !== 'approved' || !orderId) {
    await markWebhookEvent(rowId, { orderId });
    return NextResponse.json({ received: true });
  }

  try {
    await completeOrderPayment(orderId, {
      paymentId: String(payment.id),
      amount: payment.transaction_amount,
      currency: payment.currency_id,
    });
    await markWebhookEvent(rowId, { orderId });
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[webhook mercadopago] error al completar el pedido', orderId, err);
    await markWebhookEvent(rowId, { orderId, error: err });
    // Un monto que no cuadra no se arregla reintentando.
    const status = err instanceof PaymentMismatchError ? 200 : 500;
    return NextResponse.json({ error: 'No se pudo completar el pedido.' }, { status });
  }
}
