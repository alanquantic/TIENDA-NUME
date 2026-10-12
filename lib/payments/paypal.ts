import { env, type PaymentMode } from './settings';

/**
 * PayPal Orders v2 vía API REST (sin SDK).
 * Docs: https://developer.paypal.com/docs/api/orders/v2/
 */

function apiBase(mode: PaymentMode): string {
  return mode === 'production' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

function credentials(mode: PaymentMode): { clientId: string; secret: string } {
  const clientId = env(mode === 'production' ? 'PAYPAL_CLIENT_ID' : 'PAYPAL_CLIENT_ID_SANDBOX');
  const secret = env(mode === 'production' ? 'PAYPAL_CLIENT_SECRET' : 'PAYPAL_CLIENT_SECRET_SANDBOX');
  if (!clientId || !secret) throw new Error(`Faltan las credenciales de PayPal (${mode}).`);
  return { clientId, secret };
}

async function accessToken(mode: PaymentMode): Promise<string> {
  const { clientId, secret } = credentials(mode);
  const res = await fetch(`${apiBase(mode)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`PayPal ${res.status} al obtener token: ${(await res.text()).slice(0, 300)}`);
  }
  return ((await res.json()) as { access_token: string }).access_token;
}

async function ppFetch(mode: PaymentMode, path: string, init?: RequestInit): Promise<Response> {
  const token = await accessToken(mode);
  return fetch(`${apiBase(mode)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
}

async function ppJson<T>(mode: PaymentMode, path: string, init?: RequestInit): Promise<T> {
  const res = await ppFetch(mode, path, init);
  if (!res.ok) {
    throw new Error(`PayPal ${res.status} en ${path}: ${(await res.text()).slice(0, 500)}`);
  }
  return (await res.json()) as T;
}

export type PpOrderInput = {
  orderId: string;
  orderNumber: string;
  description: string;
  totalAmount: string; // "123.45"
  currency: string;
  returnUrl: string;
  cancelUrl: string;
};

/** Crea la orden y devuelve la URL de aprobación a la que se redirige al cliente. */
export async function createPpOrder(
  mode: PaymentMode,
  input: PpOrderInput,
): Promise<{ paypalOrderId: string; url: string }> {
  const order = await ppJson<{ id: string; links: { rel: string; href: string }[] }>(
    mode,
    '/v2/checkout/orders',
    {
      method: 'POST',
      headers: { 'PayPal-Request-Id': `order-${input.orderId}` },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: input.orderId,
            custom_id: input.orderId,
            invoice_id: input.orderNumber,
            description: input.description.slice(0, 127),
            amount: { currency_code: input.currency.toUpperCase(), value: input.totalAmount },
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: 'Numerología Cotidiana',
              locale: 'es-MX',
              shipping_preference: 'NO_SHIPPING',
              user_action: 'PAY_NOW',
              return_url: input.returnUrl,
              cancel_url: input.cancelUrl,
            },
          },
        },
      }),
    },
  );

  const approve = order.links.find((l) => l.rel === 'payer-action' || l.rel === 'approve');
  if (!approve) throw new Error('PayPal no devolvió la URL de aprobación.');
  return { paypalOrderId: order.id, url: approve.href };
}

export type PpCapture = {
  status: string; // COMPLETED | PENDING | DECLINED | ...
  captureId: string | null;
  orderId: string | null; // custom_id = id del pedido en la tienda
  amount: string | null;
  currency: string | null;
};

type PpOrderBody = {
  status: string;
  purchase_units?: {
    custom_id?: string;
    payments?: {
      captures?: {
        id: string;
        status: string;
        custom_id?: string;
        amount: { value: string; currency_code: string };
      }[];
    };
  }[];
};

function captureOf(order: PpOrderBody): PpCapture {
  const unit = order.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  return {
    status: capture?.status ?? order.status,
    captureId: capture?.id ?? null,
    orderId: capture?.custom_id ?? unit?.custom_id ?? null,
    amount: capture?.amount.value ?? null,
    currency: capture?.amount.currency_code ?? null,
  };
}

/** Estado actual de una orden según la API (fuente de verdad). */
export async function getPpOrder(mode: PaymentMode, paypalOrderId: string): Promise<PpCapture> {
  return captureOf(
    await ppJson<PpOrderBody>(mode, `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`),
  );
}

/**
 * Captura (cobra) una orden aprobada por el cliente. Si ya estaba capturada
 * (doble clic, webhook y retorno a la vez) devuelve la captura existente.
 */
export async function capturePpOrder(mode: PaymentMode, paypalOrderId: string): Promise<PpCapture> {
  const path = `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`;
  const res = await ppFetch(mode, `${path}/capture`, {
    method: 'POST',
    headers: { Prefer: 'return=representation', 'PayPal-Request-Id': `capture-${paypalOrderId}` },
  });

  if (res.ok) return captureOf((await res.json()) as PpOrderBody);

  const text = await res.text();
  if (res.status === 422 && text.includes('ORDER_ALREADY_CAPTURED')) {
    return captureOf(await ppJson<PpOrderBody>(mode, path));
  }
  throw new Error(`PayPal ${res.status} al capturar ${paypalOrderId}: ${text.slice(0, 500)}`);
}

/**
 * Verifica la firma de un webhook con la API de PayPal.
 * Devuelve null si no hay PAYPAL_WEBHOOK_ID configurado (no verificable).
 */
export async function verifyPpWebhook(
  mode: PaymentMode,
  headers: Headers,
  event: unknown,
): Promise<boolean | null> {
  const webhookId = env(mode === 'production' ? 'PAYPAL_WEBHOOK_ID' : 'PAYPAL_WEBHOOK_ID_SANDBOX');
  if (!webhookId) return null;

  const result = await ppJson<{ verification_status: string }>(
    mode,
    '/v1/notifications/verify-webhook-signature',
    {
      method: 'POST',
      body: JSON.stringify({
        auth_algo: headers.get('paypal-auth-algo'),
        cert_url: headers.get('paypal-cert-url'),
        transmission_id: headers.get('paypal-transmission-id'),
        transmission_sig: headers.get('paypal-transmission-sig'),
        transmission_time: headers.get('paypal-transmission-time'),
        webhook_id: webhookId,
        webhook_event: event,
      }),
    },
  );
  return result.verification_status === 'SUCCESS';
}
