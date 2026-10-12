import { createHmac, timingSafeEqual } from 'node:crypto';
import { env, type PaymentMode } from './settings';

/**
 * Mercado Pago Checkout Pro vía API REST (sin SDK).
 * Docs: https://www.mercadopago.com.mx/developers/es/reference/preferences/_checkout_preferences/post
 */

const API = 'https://api.mercadopago.com';

function accessToken(mode: PaymentMode): string {
  const token = env(mode === 'production' ? 'MERCADOPAGO_ACCESS_TOKEN' : 'MERCADOPAGO_ACCESS_TOKEN_TEST');
  if (!token) throw new Error(`Falta el access token de Mercado Pago (${mode}).`);
  return token;
}

async function mpFetch<T>(mode: PaymentMode, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken(mode)}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Mercado Pago ${res.status} en ${path}: ${body.slice(0, 500)}`);
  }
  return (await res.json()) as T;
}

export type MpPreferenceInput = {
  orderId: string;
  orderNumber: string;
  title: string;
  totalAmount: number;
  currency: string;
  payer: { email: string; firstName: string; lastName: string };
  successUrl: string;
  failureUrl: string;
  pendingUrl: string;
  /** null en local: Mercado Pago no puede llamar a localhost. */
  notificationUrl: string | null;
};

/**
 * Crea la preferencia de pago y devuelve la URL a la que se redirige al cliente.
 * Se cobra el pedido como una sola partida por su total (ya con descuento,
 * envío e impuestos) para que lo cobrado coincida exactamente con el pedido.
 */
export async function createMpPreference(
  mode: PaymentMode,
  input: MpPreferenceInput,
): Promise<{ preferenceId: string; url: string }> {
  const pref = await mpFetch<{ id: string; init_point: string; sandbox_init_point: string }>(
    mode,
    '/checkout/preferences',
    {
      method: 'POST',
      headers: { 'X-Idempotency-Key': `pref-${input.orderId}` },
      body: JSON.stringify({
        items: [
          {
            id: input.orderNumber,
            title: input.title,
            quantity: 1,
            unit_price: input.totalAmount,
            currency_id: input.currency.toUpperCase(),
          },
        ],
        payer: {
          email: input.payer.email,
          name: input.payer.firstName,
          surname: input.payer.lastName,
        },
        external_reference: input.orderId,
        metadata: { order_id: input.orderId, order_number: input.orderNumber },
        back_urls: {
          success: input.successUrl,
          failure: input.failureUrl,
          pending: input.pendingUrl,
        },
        auto_return: 'approved',
        statement_descriptor: 'NUMEROLOGIA',
        ...(input.notificationUrl ? { notification_url: input.notificationUrl } : {}),
      }),
    },
  );

  return {
    preferenceId: pref.id,
    url: mode === 'production' ? pref.init_point : pref.sandbox_init_point || pref.init_point,
  };
}

export type MpPayment = {
  id: number;
  status: string; // approved | pending | in_process | rejected | cancelled | refunded | ...
  external_reference: string | null;
  transaction_amount: number;
  currency_id: string;
};

/** Consulta un pago en la API (fuente de verdad; nunca se confía en el aviso). */
export function getMpPayment(mode: PaymentMode, paymentId: string): Promise<MpPayment> {
  return mpFetch<MpPayment>(mode, `/v1/payments/${encodeURIComponent(paymentId)}`);
}

export type MpPaymentSummary = MpPayment & { date_of_expiration: string | null };

/** Pagos asociados a un pedido (external_reference), del más reciente al más viejo. */
export async function searchMpPaymentsForOrder(
  mode: PaymentMode,
  orderId: string,
): Promise<MpPaymentSummary[]> {
  const params = new URLSearchParams({
    external_reference: orderId,
    sort: 'date_created',
    criteria: 'desc',
  });
  const res = await mpFetch<{ results: MpPaymentSummary[] }>(mode, `/v1/payments/search?${params}`);
  return res.results ?? [];
}

/**
 * Verifica la firma `x-signature` de un aviso de Mercado Pago.
 * Si no hay secreto configurado devuelve null (no verificable); el aviso igual
 * se valida consultando el pago en la API.
 */
export function verifyMpSignature(
  mode: PaymentMode,
  headers: Headers,
  dataId: string,
): boolean | null {
  const secret = env(mode === 'production' ? 'MERCADOPAGO_WEBHOOK_SECRET' : 'MERCADOPAGO_WEBHOOK_SECRET_TEST');
  if (!secret) return null;

  const signature = headers.get('x-signature') ?? '';
  const requestId = headers.get('x-request-id') ?? '';
  const parts = Object.fromEntries(
    signature.split(',').map((part) => {
      const [key, ...rest] = part.trim().split('=');
      return [key, rest.join('=')];
    }),
  );
  if (!parts.ts || !parts.v1) return false;

  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest = `id:${id};request-id:${requestId};ts:${parts.ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');

  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return a.length === b.length && timingSafeEqual(a, b);
}
