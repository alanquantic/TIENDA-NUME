import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';
import { db } from '@/lib/db';
import { orderItems, orders } from '@/lib/db/schema';
import { priceCart, PricingError } from '@/lib/pricing';
import { getStripe } from '@/lib/stripe';
import { config } from '@/lib/config';
import { fromMinorToDecimalString } from '@/lib/money';
import { checkoutSchema } from '@/lib/validation';
import { fulfillOrder } from '@/lib/fulfillment';
import { reportForSlug } from '@/lib/report-catalog';

export const runtime = 'nodejs';

function generateOrderNumber(): string {
  const stamp = Date.now().toString(36);
  const rand = randomBytes(2).toString('hex');
  return `NUME-${(stamp + rand).toUpperCase()}`;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos.', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // 1) Precio autoritativo (recalculado desde la BD).
  let quote;
  try {
    quote = await priceCart(input);
  } catch (err) {
    if (err instanceof PricingError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error('priceCart falló', err);
    return NextResponse.json({ error: 'No se pudo calcular el carrito.' }, { status: 500 });
  }

  if (quote.requiresShipping && !input.shippingAddress) {
    return NextResponse.json(
      { error: 'Falta la dirección de envío para productos físicos.' },
      { status: 400 },
    );
  }

  // 2) Crear pedido pending + ítems (snapshot inmutable).
  const number = generateOrderNumber();
  const [order] = await db
    .insert(orders)
    .values({
      number,
      customerEmail: input.email,
      customerFirstName: input.firstName,
      customerLastName: input.lastName,
      customerPhone: input.phone,
      customerBirthDate: input.birthDate ? input.birthDate : null,
      status: 'pending',
      provider: config.simulatePayments ? 'manual' : 'stripe',
      currency: quote.currency,
      subtotalAmount: fromMinorToDecimalString(quote.subtotalMinor),
      shippingAmount: fromMinorToDecimalString(quote.shippingMinor),
      taxAmount: fromMinorToDecimalString(quote.taxMinor),
      discountAmount: fromMinorToDecimalString(quote.discountMinor),
      totalAmount: fromMinorToDecimalString(quote.totalMinor),
      discountCode: quote.discountCode,
      requiresShipping: quote.requiresShipping,
      shippingMethod: quote.shippingMethod,
      shippingAddress: input.shippingAddress ?? null,
    })
    .returning();

  // Datos de reporte por variante (para guardarlos en el ítem).
  const reportByVariant = new Map((input.reports ?? []).map((r) => [r.variantId, r]));

  await db.insert(orderItems).values(
    quote.lines.map((line) => {
      const mapping = reportForSlug(line.slug);
      const reportInput = reportByVariant.get(line.variantId);
      const metadata =
        mapping && reportInput
          ? {
              report: {
                key: mapping.report,
                person: reportInput.person,
                partner: reportInput.partner ?? null,
              },
            }
          : {};
      return {
        orderId: order.id,
        productId: line.productId,
        variantId: line.variantId,
        name: line.name,
        variantName: line.variantName,
        sku: line.sku,
        type: line.type,
        unitAmount: fromMinorToDecimalString(line.unitAmountMinor),
        quantity: line.quantity,
        totalAmount: fromMinorToDecimalString(line.totalMinor),
        metadata,
      };
    }),
  );

  // ── TEMPORAL: pago simulado ────────────────────────────────────
  // Marca el pedido como pagado y corre el fulfillment real (stock +
  // descargas), sin pasarela. Quitar este bloque al integrar MP/PayPal.
  if (config.simulatePayments) {
    try {
      await fulfillOrder(order.id, { paymentIntentId: `SIMULADO-${number}` });
    } catch (err) {
      console.error('Fulfillment simulado falló', err);
      return NextResponse.json(
        { error: 'No se pudo completar la compra simulada.' },
        { status: 500 },
      );
    }
    return NextResponse.json({
      url: `${config.appUrl}/checkout/success?order=${order.id}`,
      orderId: order.id,
    });
  }

  // 3) Sesión de Stripe cuyo total == quote.totalMinor.
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = quote.lines.map(
    (line) => ({
      quantity: line.quantity,
      price_data: {
        currency: quote.currency.toLowerCase(),
        unit_amount: line.unitAmountMinor,
        product_data: {
          name: line.variantName ? `${line.name} — ${line.variantName}` : line.name,
          ...(line.image && line.image.startsWith('http') ? { images: [line.image] } : {}),
        },
      },
    }),
  );

  if (quote.taxMinor > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: quote.currency.toLowerCase(),
        unit_amount: quote.taxMinor,
        product_data: { name: 'Impuestos' },
      },
    });
  }

  if (quote.shippingMinor > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: quote.currency.toLowerCase(),
        unit_amount: quote.shippingMinor,
        product_data: { name: `Envío${quote.shippingMethod ? ` (${quote.shippingMethod})` : ''}` },
      },
    });
  }

  let session;
  try {
    const stripe = getStripe();

    // Descuento: cupón ad-hoc amount_off (reduce el total exactamente en discountMinor).
    const discounts: Stripe.Checkout.SessionCreateParams.Discount[] = [];
    if (quote.discountMinor > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: quote.discountMinor,
        currency: quote.currency.toLowerCase(),
        duration: 'once',
        name: quote.discountCode ?? 'Descuento',
        max_redemptions: 1,
      });
      discounts.push({ coupon: coupon.id });
    }

    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: input.email,
      line_items: lineItems,
      discounts: discounts.length ? discounts : undefined,
      success_url: `${config.appUrl}/checkout/success?order=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.appUrl}/checkout/cancel?order=${order.id}`,
      metadata: { orderId: order.id, orderNumber: number },
      payment_intent_data: { metadata: { orderId: order.id } },
    });
  } catch (err) {
    console.error('Inicio de pago falló', err);
    await db
      .update(orders)
      .set({ status: 'cancelled', cancelledAt: new Date() })
      .where(eq(orders.id, order.id));
    return NextResponse.json(
      { error: 'No se pudo iniciar el pago. Intenta de nuevo.' },
      { status: 502 },
    );
  }

  await db
    .update(orders)
    .set({ externalCheckoutId: session.id, updatedAt: new Date() })
    .where(eq(orders.id, order.id));

  return NextResponse.json({ url: session.url, orderId: order.id });
}
