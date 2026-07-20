// Objeto que se envía a los sistemas externos al completarse una compra, y la
// función PURA que lo arma. Sin red, sin BD y sin `server-only`, para poder
// previsualizarlo y testearlo fuera de Next.
//
// El envío vive en `lib/external-hooks.ts` (ese sí es server-only).

import {
  accessForProduct,
  type ExternalHookGroup,
  type ProductDuration,
} from './product-groups';

/** 'membership' | 'license' | 'numerathum' | 'kit-primavera' | 'agenda-fisica-2026' */
export type ExternalHookKind = ExternalHookGroup;

export const EXTERNAL_EVENT = 'purchase.completed' as const;

/**
 * Ruteo: qué endpoint recibe cada grupo. Son TRES destinos —
 *   1. membresías            → MEMBERSHIP_WEBHOOK_URL
 *   2. licencias Arithmax    → LICENSE_WEBHOOK_URL
 *   3. kit primavera, numerathum Y agenda física 2026 → KIT_NUMERATHUM_WEBHOOK_URL
 *
 * Los tres del destino 3 van al MISMO endpoint a propósito; el receptor los
 * distingue por el campo `kind` del payload.
 */
export const ENDPOINT_ENV: Record<ExternalHookKind, string> = {
  membership: 'MEMBERSHIP_WEBHOOK_URL',
  license: 'LICENSE_WEBHOOK_URL',
  numerathum: 'KIT_NUMERATHUM_WEBHOOK_URL',
  'kit-primavera': 'KIT_NUMERATHUM_WEBHOOK_URL',
  'agenda-fisica-2026': 'KIT_NUMERATHUM_WEBHOOK_URL',
};

/** Nombre de la variable de entorno con el endpoint de ese grupo. */
export function envVarFor(kind: ExternalHookKind): string {
  return ENDPOINT_ENV[kind];
}

// ───────────────────────────────────────────────────────────────
// Forma del objeto
// ───────────────────────────────────────────────────────────────

export type PurchaseCustomer = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  phone: string | null;
  /** YYYY-MM-DD */
  birthDate: string | null;
};

/**
 * Vigencia del acceso que otorga un producto (membresías, licencias, kit,
 * numerathum). `null` en productos sin caducidad (reportes, libro, agendas…).
 */
export type PurchaseAccess = {
  /** Código estable del plan (mapea del lado receptor). */
  planCode: string;
  /** Duración contratada, en su unidad natural (ej. 3 años). */
  duration: ProductDuration;
  /** La misma duración normalizada a meses (null si viene en días). */
  durationMonths: number | null;
  /** Inicio del acceso = pago del pedido (ISO-8601). */
  startsAt: string;
  /**
   * Vencimiento = startsAt + duration (ISO-8601).
   * ⚠️ En RENOVACIONES la tienda no sabe cuándo vence el acceso actual del
   * cliente: el sistema receptor debe extender desde el vencimiento vigente
   * usando `duration`, en vez de tomar este valor tal cual.
   */
  expiresAt: string;
};

export type PurchaseItem = {
  slug: string | null;
  name: string;
  variantName: string | null;
  sku: string | null;
  type: 'digital' | 'physical';
  quantity: number;
  /** Decimales como STRING para no perder precisión (ej. "2699.00"). */
  unitAmount: string;
  totalAmount: string;
  /** Vigencia, si el producto otorga un acceso con caducidad. */
  access: PurchaseAccess | null;
};

export type PurchaseOrder = {
  id: string;
  number: string;
  status: string;
  currency: string;
  /** ISO-8601 */
  paidAt: string | null;
  subtotalAmount: string;
  discountAmount: string;
  discountCode: string | null;
  shippingAmount: string;
  taxAmount: string;
  totalAmount: string;
  requiresShipping: boolean;
  shippingMethod: string | null;
  shippingAddress: Record<string, unknown> | null;
  requiresInvoice: boolean;
  billingInfo: Record<string, unknown> | null;
  /** TODOS los ítems del pedido, no solo los del grupo. */
  items: PurchaseItem[];
};

export type ExternalPurchasePayload = {
  event: typeof EXTERNAL_EVENT;
  kind: ExternalHookKind;
  /** ISO-8601 del momento del envío. */
  sentAt: string;
  /** Clave de idempotencia; se repite si se reintenta el mismo aviso. */
  deliveryId: string;
  customer: PurchaseCustomer;
  order: PurchaseOrder;
  /** Los ítems de ESTE grupo que dispararon el aviso. */
  triggeredBy: PurchaseItem[];
};

// ───────────────────────────────────────────────────────────────
// Entradas del builder
// ───────────────────────────────────────────────────────────────

/** Lo mínimo que se necesita de un pedido (compatible con la fila de BD). */
export type OrderLike = {
  id: string;
  number: string;
  status: string;
  currency: string;
  paidAt: Date | string | null;
  subtotalAmount: string;
  discountAmount: string;
  discountCode: string | null;
  shippingAmount: string;
  taxAmount: string;
  totalAmount: string;
  requiresShipping: boolean;
  shippingMethod: string | null;
  shippingAddress: unknown;
  requiresInvoice: boolean;
  billingInfo: unknown;
  customerEmail: string;
  customerFirstName: string | null;
  customerLastName: string | null;
  customerPhone: string | null;
  customerBirthDate: string | null;
};

/** Ítem del pedido + su slug (order_items guarda snapshot, no el slug). */
export type ItemLike = {
  slug: string | null;
  name: string;
  variantName: string | null;
  sku: string | null;
  type: 'digital' | 'physical';
  quantity: number;
  unitAmount: string;
  totalAmount: string;
};

function toIso(v: Date | string | null): string | null {
  if (!v) return null;
  return v instanceof Date ? v.toISOString() : v;
}

/**
 * Suma meses en UTC recortando al último día del mes destino, para que
 * "31 de enero + 1 mes" sea 28/29 de febrero y no se desborde a marzo.
 */
function addMonthsUtc(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

export function addDuration(date: Date, duration: ProductDuration): Date {
  if (duration.unit === 'day') {
    const d = new Date(date.getTime());
    d.setUTCDate(d.getUTCDate() + duration.value);
    return d;
  }
  const months = duration.unit === 'year' ? duration.value * 12 : duration.value;
  return addMonthsUtc(date, months);
}

/** Duración normalizada a meses (null si viene en días). */
export function durationToMonths(duration: ProductDuration): number | null {
  if (duration.unit === 'month') return duration.value;
  if (duration.unit === 'year') return duration.value * 12;
  return null;
}

function toItem(i: ItemLike, startsAtIso: string): PurchaseItem {
  const cfg = accessForProduct(i.slug);
  return {
    slug: i.slug,
    name: i.name,
    variantName: i.variantName,
    sku: i.sku,
    type: i.type,
    quantity: i.quantity,
    unitAmount: i.unitAmount,
    totalAmount: i.totalAmount,
    access: cfg
      ? {
          planCode: cfg.planCode,
          duration: cfg.duration,
          durationMonths: durationToMonths(cfg.duration),
          startsAt: startsAtIso,
          expiresAt: addDuration(new Date(startsAtIso), cfg.duration).toISOString(),
        }
      : null,
  };
}

/**
 * Arma el objeto que se enviará. Puro: mismas entradas → mismo objeto
 * (salvo `sentAt`, que se puede fijar para tests/preview).
 */
export function buildPurchasePayload(input: {
  kind: ExternalHookKind;
  order: OrderLike;
  /** Todos los ítems del pedido. */
  items: ItemLike[];
  /** Los ítems del grupo que dispara el aviso. */
  triggerItems: ItemLike[];
  sentAt?: string;
}): ExternalPurchasePayload {
  const { kind, order } = input;
  const fullName = `${order.customerFirstName ?? ''} ${order.customerLastName ?? ''}`.trim();
  const sentAt = input.sentAt ?? new Date().toISOString();
  // El acceso arranca al pagarse el pedido; si aún no hay paidAt, al enviarse.
  const startsAt = toIso(order.paidAt) ?? sentAt;

  return {
    event: EXTERNAL_EVENT,
    kind,
    sentAt,
    deliveryId: `${order.id}:${kind}`,
    customer: {
      email: order.customerEmail,
      firstName: order.customerFirstName,
      lastName: order.customerLastName,
      fullName: fullName || null,
      phone: order.customerPhone,
      birthDate: order.customerBirthDate,
    },
    order: {
      id: order.id,
      number: order.number,
      status: order.status,
      currency: order.currency,
      paidAt: toIso(order.paidAt),
      subtotalAmount: order.subtotalAmount,
      discountAmount: order.discountAmount,
      discountCode: order.discountCode,
      shippingAmount: order.shippingAmount,
      taxAmount: order.taxAmount,
      totalAmount: order.totalAmount,
      requiresShipping: order.requiresShipping,
      shippingMethod: order.shippingMethod,
      shippingAddress: (order.shippingAddress as Record<string, unknown> | null) ?? null,
      requiresInvoice: order.requiresInvoice,
      billingInfo: (order.billingInfo as Record<string, unknown> | null) ?? null,
      items: input.items.map((i) => toItem(i, startsAt)),
    },
    triggeredBy: input.triggerItems.map((i) => toItem(i, startsAt)),
  };
}
