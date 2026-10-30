// Etiquetas del admin para saber qué se vendió (reporte, reporte IA,
// membresía…) y si un pedido fue de prueba. Sin dependencias server-only:
// las usan las páginas del admin, el CSV y las métricas.

import { sql } from 'drizzle-orm';
import { orders, type Order } from '../db/schema';
import { groupForProduct, type ProductGroup } from '../product-groups';
import { reportsForSlug } from '../report-catalog';
import { isTestPayment } from '../payments/test-payment';

export type ItemKind =
  | 'ai-report'
  | 'report'
  | 'static-pdf'
  | ProductGroup
  | 'digital'
  | 'physical';

export const ITEM_KIND_LABEL: Record<ItemKind, string> = {
  'ai-report': 'Reporte IA',
  report: 'Reporte',
  'static-pdf': 'PDF',
  membership: 'Membresía',
  license: 'Licencia',
  certification: 'Certificación',
  numerathum: 'Numerathum',
  'kit-primavera': 'Kit',
  'agenda-fisica-2026': 'Agenda física',
  digital: 'Digital',
  physical: 'Físico',
};

/**
 * Tipo de un ítem vendido. `reportEngines` son los motores de los reportes que
 * el pedido generó para ese ítem: cubren productos cuyo slug ya no coincide con
 * el catálogo de reportes (se renombraron desde el admin).
 */
export function itemKind(item: {
  slug: string | null;
  categorySlug: string | null;
  type: 'digital' | 'physical';
  reportEngines?: string[];
}): ItemKind {
  const group = item.slug ? groupForProduct(item.slug, item.categorySlug) : null;
  if (group) return group;
  const mappings = item.slug ? reportsForSlug(item.slug) : [];
  if (mappings.some((m) => m.engine === 'ai') || item.reportEngines?.includes('ai')) return 'ai-report';
  if (mappings.some((m) => m.kind === 'generated') || item.reportEngines?.includes('legacy')) return 'report';
  if (mappings.some((m) => m.kind === 'static')) return 'static-pdf';
  return item.type === 'physical' ? 'physical' : 'digital';
}

/** Cupones de prueba: el código dice "test" o "prueba". */
const TEST_COUPON_RE = /test|prueba/i;

/**
 * Pedido de prueba: pagado con credenciales sandbox / simulado, o con un cupón
 * de prueba que dejó el total en 0.
 */
export function isTestOrder(
  order: Pick<Order, 'metadata' | 'externalPaymentIntentId' | 'discountCode' | 'totalAmount'>,
): boolean {
  if (isTestPayment(order)) return true;
  return !!order.discountCode && TEST_COUPON_RE.test(order.discountCode) && Number(order.totalAmount) === 0;
}

/** Misma regla que `isTestOrder`, para filtrar en SQL. */
export const testOrderSql = sql`(
  coalesce(${orders.metadata}->>'paymentMode', '') = 'sandbox'
  or coalesce(${orders.externalPaymentIntentId}, '') like 'SIMULADO-%'
  or (coalesce(${orders.discountCode}, '') ~* '(test|prueba)' and ${orders.totalAmount} = 0)
)`;
