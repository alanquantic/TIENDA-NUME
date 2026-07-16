import 'server-only';
import type { ExternalHookGroup } from './product-groups';

/**
 * Avisos a sistemas externos cuando se compra cierto producto (membresías,
 * licencias Arithmax, Numerathum, Kit Primavera).
 *
 * ⚠️ PENDIENTE DE CONFIGURAR — se retomará más adelante.
 * Hoy están INACTIVOS: si la variable de entorno del endpoint no existe, la
 * función solo registra en consola y no envía nada. Para activarlos, define la
 * URL correspondiente en el entorno y (si aplica) el secreto compartido:
 *
 *   MEMBERSHIP_WEBHOOK_URL=https://...     ← membresías 180/360
 *   LICENSE_WEBHOOK_URL=https://...        ← licencias Arithmax 1/3 años
 *   NUMERATHUM_WEBHOOK_URL=https://...     ← Numerathum Oráculo 365
 *   KIT_PRIMAVERA_WEBHOOK_URL=https://...  ← Kit Primavera
 *   EXTERNAL_WEBHOOK_SECRET=...            ← opcional: firma HMAC-SHA256
 *
 * Cuando se retome, revisar con el proveedor: formato exacto del payload,
 * autenticación y política de reintentos.
 */

export type PurchaseCustomer = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  birthDate: string | null;
};

export type PurchaseProduct = {
  slug: string;
  name: string;
  variantName: string | null;
  quantity: number;
  unitAmount: string;
  totalAmount: string;
};

/** 'membership' | 'license' | 'numerathum' | 'kit-primavera' */
export type ExternalHookKind = ExternalHookGroup;

export type PurchaseNotification = {
  kind: ExternalHookKind;
  orderId: string;
  orderNumber: string;
  currency: string;
  paidAt: string | null;
  customer: PurchaseCustomer;
  product: PurchaseProduct;
};

const ENDPOINT_ENV: Record<ExternalHookKind, string> = {
  membership: 'MEMBERSHIP_WEBHOOK_URL',
  license: 'LICENSE_WEBHOOK_URL',
  numerathum: 'NUMERATHUM_WEBHOOK_URL',
  'kit-primavera': 'KIT_PRIMAVERA_WEBHOOK_URL',
};

function endpointFor(kind: ExternalHookKind): string | null {
  return process.env[ENDPOINT_ENV[kind]] || null;
}

/**
 * Envía el aviso al endpoint externo. Best-effort: NUNCA lanza, para no romper
 * el fulfillment ni el correo de confirmación (igual que el envío de correo).
 * Si el endpoint no está configurado, solo deja rastro en consola.
 */
export async function notifyExternalPurchase(payload: PurchaseNotification): Promise<void> {
  const url = endpointFor(payload.kind);
  if (!url) {
    console.info(
      `[hook:${payload.kind}] (sin ${ENDPOINT_ENV[payload.kind]}) se habría enviado ` +
        `pedido ${payload.orderNumber} · ${payload.product.slug} · ${payload.customer.email}`,
    );
    return;
  }

  try {
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    // Firma opcional, mismo esquema que el generador de reportes.
    const secret = process.env.EXTERNAL_WEBHOOK_SECRET;
    if (secret) {
      const { createHmac } = await import('node:crypto');
      headers['X-Signature'] = createHmac('sha256', secret).update(body).digest('hex');
    }

    const res = await fetch(url, { method: 'POST', headers, body, cache: 'no-store' });
    if (!res.ok) {
      console.error(`[hook:${payload.kind}] ${url} respondió ${res.status} para ${payload.orderNumber}`);
    }
  } catch (err) {
    console.error(`[hook:${payload.kind}] error enviando ${payload.orderNumber}:`, err);
  }
}
