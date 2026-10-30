import { and, eq, gt, gte, inArray, lt, not, sql } from 'drizzle-orm';
import { db } from '../db';
import { orderItems, orders } from '../db/schema';
import { PAID_STATUSES, type MetricsFilters } from './sales-metrics';

const testOrder = sql<boolean>`(
    coalesce(${orders.metadata}->>'paymentMode', '') = 'sandbox'
    OR coalesce(${orders.externalPaymentIntentId}, '') LIKE 'SIMULADO-%'
    OR (${orders.subtotalAmount} > 0 AND ${orders.discountAmount} >= ${orders.subtotalAmount}
      AND coalesce(${orders.discountCode}, '') ~* '(test|prueba)')
  )`;
export function metricsWhere(filters: MetricsFilters) {
  return and(
    eq(orders.currency, filters.currency),
    gte(orders.createdAt, sql`${filters.from}::date::timestamp AT TIME ZONE 'America/Mexico_City'`),
    lt(orders.createdAt, sql`(${filters.to}::date + 1)::timestamp AT TIME ZONE 'America/Mexico_City'`),
    filters.kind === 'test' ? testOrder : filters.kind === 'real' ? not(testOrder) : undefined,
  );
}

export async function getSalesMetrics(filters: MetricsFilters) {
  if (filters.error) throw new Error('Invalid metrics filters');
  const condition = metricsWhere(filters);
  // Un envío cobrado sobre productos regalados no representa una venta comercial.
  const commercial = and(
    not(testOrder),
    gt(orders.totalAmount, '0'),
    sql`${orders.subtotalAmount} > ${orders.discountAmount}`,
  );
  const day = sql<string>`to_char(${orders.createdAt} AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD')`;
  const units = sql<number>`sum(${orderItems.quantity})::int`.mapWith(Number);
  const [daily, topProducts] = await Promise.all([
    db.select({ day, status: orders.status,
      count: sql<number>`count(*)::int`.mapWith(Number),
      commercialCount: sql<number>`count(*) FILTER (WHERE ${commercial})::int`.mapWith(Number),
      totalMinor: sql<number>`(coalesce(sum(${orders.totalAmount}) FILTER (WHERE ${commercial}), 0) * 100)::bigint`.mapWith(Number),
    }).from(orders).where(condition).groupBy(day, orders.status).orderBy(day),
    db.select({
      name: sql<string>`min(${orderItems.name})`, units,
      orders: sql<number>`count(distinct ${orders.id})::int`.mapWith(Number),
    }).from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(condition, commercial, gt(orderItems.totalAmount, '0'), inArray(orders.status, PAID_STATUSES as ('paid' | 'fulfilled' | 'refunded' | 'partially_refunded')[])))
      .groupBy(sql`coalesce(${orderItems.productId}::text, ${orderItems.name})`)
      .orderBy(sql`${units} desc`).limit(8),
  ]);
  return { daily, topProducts };
}

export function getMetricsCurrencies() {
  return db.selectDistinct({ currency: orders.currency }).from(orders).orderBy(orders.currency);
}
