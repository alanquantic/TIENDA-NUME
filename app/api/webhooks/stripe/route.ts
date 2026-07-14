import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orders, webhookEvents } from '@/lib/db/schema';
import { getStripe } from '@/lib/stripe';
import { stripeConfig } from '@/lib/config';
import { fulfillOrder } from '@/lib/fulfillment';

export const runtime = 'nodejs';
// El webhook necesita el cuerpo crudo para verificar la firma.
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Falta firma.' }, { status: 400 });
  }
  if (!stripeConfig.webhookSecret) {
    console.error('Falta STRIPE_WEBHOOK_SECRET');
    return NextResponse.json({ error: 'Webhook no configurado.' }, { status: 500 });
  }

  const rawBody = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, stripeConfig.webhookSecret);
  } catch (err) {
    console.error('Firma de webhook inválida', err);
    return NextResponse.json({ error: 'Firma inválida.' }, { status: 400 });
  }

  // Idempotencia: registrar el evento. Si ya existe, no reprocesar.
  const inserted = await db
    .insert(webhookEvents)
    .values({
      provider: 'stripe',
      eventId: event.id,
      eventType: event.type,
      status: 'pending',
      payload: event as unknown as Record<string, unknown>,
    })
    .onConflictDoNothing({ target: [webhookEvents.provider, webhookEvents.eventId] })
    .returning({ id: webhookEvents.id });

  if (inserted.length === 0) {
    // Evento ya visto → ack sin reprocesar.
    return NextResponse.json({ received: true, duplicate: true });
  }
  const eventRowId = inserted[0].id;

  try {
    await handleEvent(event);
    await db
      .update(webhookEvents)
      .set({ status: 'processed', processedAt: new Date() })
      .where(eq(webhookEvents.id, eventRowId));
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error(`Error procesando ${event.type}`, err);
    await db
      .update(webhookEvents)
      .set({
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      })
      .where(eq(webhookEvents.id, eventRowId));
    // 500 → Stripe reintenta (segunda red de seguridad).
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status !== 'paid') return; // aún no pagado (async pendiente)
      const orderId = session.metadata?.orderId;
      if (!orderId) throw new Error('Sesión sin orderId en metadata');
      await fulfillOrder(orderId, {
        paymentIntentId:
          typeof session.payment_intent === 'string' ? session.payment_intent : null,
        customerId: typeof session.customer === 'string' ? session.customer : null,
      });
      return;
    }
    case 'checkout.session.expired': {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;
      if (!orderId) return;
      await db
        .update(orders)
        .set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() })
        .where(eq(orders.id, orderId));
      return;
    }
    default:
      // Otros eventos se registran pero no requieren acción por ahora.
      return;
  }
}
