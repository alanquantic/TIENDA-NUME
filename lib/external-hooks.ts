import 'server-only';
import { createHmac } from 'node:crypto';
import {
  buildPurchasePayload,
  envVarFor,
  type ExternalHookKind,
  type ExternalPurchasePayload,
  type ItemLike,
  type OrderLike,
} from './external-purchase';

/**
 * Envío del aviso a sistemas externos cuando se completa una compra de cierto
 * grupo (membresías, licencias Arithmax, Numerathum, Kit Primavera).
 *
 * El OBJETO y su armado viven en `lib/external-purchase.ts` (puro y testeable);
 * aquí solo está el transporte (HTTP + firma), que es server-only porque usa
 * node:crypto y el secreto compartido.
 *
 * Se dispara UNA vez por grupo presente en el pedido (no una por producto) y
 * siempre lleva el pedido completo + el cliente.
 *
 * Son TRES destinos (el ruteo vive en `ENDPOINT_ENV`, en external-purchase):
 *
 *   MEMBERSHIP_WEBHOOK_URL=https://...      ← 1. membresías 180/360
 *   LICENSE_WEBHOOK_URL=https://...         ← 2. licencias Arithmax 1/3 años
 *   KIT_NUMERATHUM_WEBHOOK_URL=https://...  ← 3. Kit Primavera Y Numerathum
 *   STORE_WEBHOOK_SECRET=...                ← firma HMAC-SHA256 (mismo valor en el API receptor)
 *
 * ⚠️ INACTIVO mientras no exista la variable de entorno del endpoint: en ese
 * caso solo deja rastro en consola y no envía nada.
 */

export type {
  ExternalHookKind,
  ExternalPurchasePayload,
  ItemLike,
  OrderLike,
} from './external-purchase';
export { buildPurchasePayload, EXTERNAL_EVENT, ENDPOINT_ENV, envVarFor } from './external-purchase';

export function endpointFor(kind: ExternalHookKind): string | null {
  return process.env[envVarFor(kind)] || null;
}

/**
 * Envía el aviso. Best-effort: NUNCA lanza, para no romper el fulfillment ni el
 * correo de confirmación (misma política que el envío de correo).
 * Devuelve el payload enviado (o el que se habría enviado) para poder loguear.
 */
export async function notifyExternalPurchase(input: {
  kind: ExternalHookKind;
  order: OrderLike;
  items: ItemLike[];
  triggerItems: ItemLike[];
}): Promise<ExternalPurchasePayload> {
  const payload = buildPurchasePayload(input);
  const url = endpointFor(input.kind);

  if (!url) {
    console.info(
      `[hook:${input.kind}] (sin ${envVarFor(input.kind)}) se habría enviado ` +
        `pedido ${payload.order.number} · ${payload.customer.email} · ` +
        `${payload.triggeredBy.map((i) => i.slug ?? i.name).join(', ')}`,
    );
    return payload;
  }

  try {
    // Se firma EXACTAMENTE el mismo string que se envía como cuerpo.
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Nume-Event': payload.event,
      'X-Nume-Kind': payload.kind,
      'X-Nume-Delivery': payload.deliveryId,
    };

    const secret = process.env.STORE_WEBHOOK_SECRET;
    if (secret) {
      headers['X-Signature'] = createHmac('sha256', secret).update(body).digest('hex');
    } else {
      console.warn(
        `[hook:${input.kind}] sin STORE_WEBHOOK_SECRET: se envía SIN firma (X-Signature). ` +
          `Si el endpoint valida firma, responderá 401.`,
      );
    }

    const res = await fetch(url, { method: 'POST', headers, body, cache: 'no-store' });
    if (!res.ok) {
      console.error(
        `[hook:${input.kind}] ${url} respondió ${res.status} para ${payload.order.number}`,
      );
    }
  } catch (err) {
    console.error(`[hook:${input.kind}] error enviando ${payload.order.number}:`, err);
  }
  return payload;
}
