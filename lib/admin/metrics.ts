import { and, desc, eq, gte, inArray, lt, not, sql } from 'drizzle-orm';
import { db } from '../db';
import { abandonedCarts, generatedReports, orderItems, orders } from '../db/schema';
import { itemsForOrders } from './order-items';
import { ITEM_KIND_LABEL, testOrderSql } from './order-kinds';
import type { MetricsKind } from './sales-metrics';

/** Estados que cuentan como venta. */
const SOLD = ['paid', 'fulfilled', 'partially_refunded'] as const;

export type SalesMetrics = Awaited<ReturnType<typeof salesMetrics>>;

/**
 * Ventas entre dos fechas YYYY-MM-DD, ambas incluidas, en hora de Ciudad de
 * México. Por omisión solo pedidos reales, en cualquier moneda.
 */
export async function salesMetrics(
  from: string,
  to: string,
  { currency, kind = 'real' }: { currency?: string; kind?: MetricsKind } = {},
) {
  const start = sql`${from}::date::timestamp AT TIME ZONE 'America/Mexico_City'`;
  const end = sql`(${to}::date + 1)::timestamp AT TIME ZONE 'America/Mexico_City'`;
  const inPeriod = and(
    gte(orders.createdAt, start),
    lt(orders.createdAt, end),
    currency ? eq(orders.currency, currency) : undefined,
  );
  const ofKind = kind === 'real' ? not(testOrderSql) : kind === 'test' ? testOrderSql : undefined;
  const sold = and(inPeriod, inArray(orders.status, [...SOLD]), ofKind);

  const [[totals], [tests], byDay, soldOrders, topProducts, [aiCost], [carts], byStatus] = await Promise.all([
    db
      .select({
        orders: sql<number>`count(*)::int`,
        revenue: sql<string>`coalesce(sum(${orders.totalAmount}), 0)`,
        discounts: sql<string>`coalesce(sum(${orders.discountAmount}), 0)`,
      })
      .from(orders)
      .where(sold),
    db.select({ n: sql<number>`count(*)::int` }).from(orders).where(and(inPeriod, testOrderSql)),
    db
      .select({
        day: sql<string>`to_char(${orders.createdAt} AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD')`,
        orders: sql<number>`count(*)::int`,
        revenue: sql<string>`coalesce(sum(${orders.totalAmount}), 0)`,
      })
      .from(orders)
      .where(sold)
      .groupBy(sql`1`)
      .orderBy(sql`1`),
    db.select({ id: orders.id }).from(orders).where(sold),
    db
      .select({
        name: orderItems.name,
        quantity: sql<number>`sum(${orderItems.quantity})::int`,
        revenue: sql<string>`sum(${orderItems.totalAmount})`,
      })
      .from(orderItems)
      .innerJoin(orders, sql`${orders.id} = ${orderItems.orderId}`)
      .where(sold)
      .groupBy(orderItems.name)
      .orderBy(desc(sql`sum(${orderItems.totalAmount})`))
      .limit(10),
    db
      .select({
        reports: sql<number>`count(${generatedReports.usage})::int`,
        tokens: sql<string>`coalesce(sum((${generatedReports.usage}->>'tokenCostUsd')::numeric), 0)`,
        production: sql<string>`coalesce(sum((${generatedReports.usage}->>'productionCostUsd')::numeric), 0)`,
      })
      .from(generatedReports)
      .innerJoin(orders, sql`${orders.id} = ${generatedReports.orderId}`)
      .where(sold),
    db
      .select({
        saved: sql<number>`count(*)::int`,
        notified: sql<number>`count(${abandonedCarts.notifiedAt})::int`,
        clicked: sql<number>`count(${abandonedCarts.clickedAt})::int`,
        recovered: sql<number>`count(*) filter (where ${abandonedCarts.status} = 'recovered')::int`,
        recoveredAmount: sql<string>`coalesce(sum(${abandonedCarts.purchasedAmount}) filter (where ${abandonedCarts.status} = 'recovered'), 0)`,
        converted: sql<number>`count(*) filter (where ${abandonedCarts.status} = 'converted')::int`,
        open: sql<number>`count(*) filter (where ${abandonedCarts.status} in ('open', 'notified'))::int`,
        openAmount: sql<string>`coalesce(sum(${abandonedCarts.subtotalAmount}) filter (where ${abandonedCarts.status} in ('open', 'notified')), 0)`,
      })
      .from(abandonedCarts)
      .where(and(gte(abandonedCarts.createdAt, start), lt(abandonedCarts.createdAt, end))),
    // Todos los pedidos del periodo, también los que no cuentan como venta.
    db
      .select({ status: orders.status, n: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(inPeriod, ofKind))
      .groupBy(orders.status),
  ]);

  // Ventas por tipo de producto (Reporte IA, Membresía…), sumando sus líneas.
  const itemsByOrder = await itemsForOrders(soldOrders.map((o) => o.id));
  const byKind = new Map<string, { label: string; quantity: number; revenue: number }>();
  for (const items of itemsByOrder.values()) {
    for (const item of items) {
      const entry = byKind.get(item.kind) ?? { label: ITEM_KIND_LABEL[item.kind], quantity: 0, revenue: 0 };
      entry.quantity += item.quantity;
      entry.revenue += Number(item.totalAmount);
      byKind.set(item.kind, entry);
    }
  }

  // Serie diaria completa: los días sin ventas valen 0 (no se saltan).
  const dayMap = new Map(byDay.map((d) => [d.day, d]));
  const days: { day: string; orders: number; revenue: number }[] = [];
  for (let d = new Date(`${from}T12:00:00Z`); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    const row = dayMap.get(key);
    days.push({ day: key, orders: row?.orders ?? 0, revenue: Number(row?.revenue ?? 0) });
  }

  const revenue = Number(totals.revenue);
  return {
    orders: totals.orders,
    revenue,
    discounts: Number(totals.discounts),
    averageTicket: totals.orders ? revenue / totals.orders : 0,
    testOrders: tests.n,
    statusCounts: Object.fromEntries(byStatus.map((s) => [s.status, s.n])) as Record<string, number>,
    days,
    byKind: [...byKind.values()].sort((a, b) => b.revenue - a.revenue),
    topProducts: topProducts.map((p) => ({ ...p, revenue: Number(p.revenue) })),
    ai: { reports: aiCost.reports, tokens: Number(aiCost.tokens), production: Number(aiCost.production) },
    carts: {
      ...carts,
      recoveredAmount: Number(carts.recoveredAmount),
      openAmount: Number(carts.openAmount),
    },
  };
}

/** Monedas con pedidos, para el filtro de métricas. */
export function getMetricsCurrencies() {
  return db.selectDistinct({ currency: orders.currency }).from(orders).orderBy(orders.currency);
}
