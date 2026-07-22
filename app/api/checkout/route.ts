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
import { reportsForSlug, AGENDA_2025_COLORS, type ReportKey } from '@/lib/report-catalog';

/** Lo que se guarda en orderItems.metadata.reports (lo lee el fulfillment). */
type ReportMetaOut = {
  key: ReportKey;
  kind: 'static' | 'generated';
  label: string;
  variant?: string;
  person?: { name: string; birthDate: string };
  partner?: { name: string; birthDate: string } | null;
};

export const runtime = 'nodejs';

function generateOrderNumber(): string {
  const stamp = Date.now().toString(36);
  const rand = randomBytes(2).toString('hex');
  return `NUME-${(stamp + rand).toUpperCase()}`;
}

/**
 * Deriva el color (variant) de un estático con versiones a partir de la variante
 * comprada. Preferimos `attributes.color`; si falta, se infiere del nombre.
 */
function variantColor(
  attributes: Record<string, unknown>,
  variantName: string | null,
): string | undefined {
  const colors = AGENDA_2025_COLORS as readonly string[];
  const attr = attributes?.color;
  if (typeof attr === 'string' && colors.includes(attr)) return attr;
  const n = (variantName ?? '').toLowerCase();
  if (n.startsWith('mora')) return 'morado'; // "Morada" (sitio) → código "morado"
  if (colors.includes(n)) return n;
  return undefined;
}

/**
 * URL base para las redirecciones post-compra (success/cancel).
 * Prioridad:
 *   1) NEXT_PUBLIC_APP_URL si apunta a un dominio real (no localhost) — canónico.
 *   2) El origen de la propia petición (así nunca manda al buyer a localhost en
 *      producción aunque la env esté mal/ausente).
 * Nunca fija localhost cuando la tienda se sirve desde otro dominio.
 */
function resolveBaseUrl(req: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (configured && !/localhost|127\.0\.0\.1/.test(configured)) return configured;

  const origin = req.headers.get('origin');
  if (origin && /^https?:\/\//.test(origin)) return origin.replace(/\/$/, '');

  const host = req.headers.get('host');
  if (host) {
    const proto = req.headers.get('x-forwarded-proto') ?? 'https';
    return `${proto}://${host}`;
  }
  return configured ?? config.appUrl;
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
  const baseUrl = resolveBaseUrl(req);

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
      requiresInvoice: input.requiresInvoice ?? false,
      billingInfo: input.requiresInvoice ? (input.billingInfo ?? null) : null,
    })
    .returning();

  // Datos de reporte por (variantId, reportKey). Dos productos que compartan el
  // mismo reportKey capturan datos por separado (regalo para otra persona).
  const reportByVariantAndKey = new Map(
    (input.reports ?? []).map((r) => [`${r.variantId}:${r.reportKey}`, r]),
  );

  await db.insert(orderItems).values(
    quote.lines.map((line) => {
      // Un producto puede entregar varios reportes (membresías, kits, bundles).
      const reportMetas = reportsForSlug(line.slug).flatMap((m): ReportMetaOut[] => {
        if (m.kind === 'static') {
          // PDF pre-hecho: sin person/partner. Agenda 2025 lleva `variant` (color).
          return [
            {
              key: m.report,
              kind: 'static' as const,
              label: m.label,
              ...(m.needsVariant
                ? { variant: variantColor(line.variantAttributes, line.variantName) }
                : {}),
            },
          ];
        }
        // Generado: usa los datos capturados para ESTA variante + reporte.
        const reportInput = reportByVariantAndKey.get(`${line.variantId}:${m.report}`);
        if (!reportInput) return [];
        return [
          {
            key: m.report,
            kind: 'generated' as const,
            label: m.label,
            person: reportInput.person,
            // Solo los que lo piden reciben pareja (los demás darían 422).
            partner: m.needsPartner ? (reportInput.partner ?? null) : null,
          },
        ];
      });
      const metadata: Record<string, unknown> = reportMetas.length ? { reports: reportMetas } : {};
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
      // En modo simulado (solo pruebas) devolvemos el detalle real para poder
      // diagnosticar desde la pestaña Red del navegador. Esta rama nunca se
      // alcanza con pagos reales, así que no filtra nada en producción.
      const detail = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: 'No se pudo completar la compra simulada.', detail },
        { status: 500 },
      );
    }
    return NextResponse.json({
      url: `${baseUrl}/checkout/success?order=${order.id}`,
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
      success_url: `${baseUrl}/checkout/success?order=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/checkout/cancel?order=${order.id}`,
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
