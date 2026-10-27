import { and, eq, exists, gte, isNull, lt, not, sql, type SQL } from 'drizzle-orm';
import { db } from '../db';
import { orderItems, orders, products } from '../db/schema';
import { NO_CATEGORY, type OrderFilters } from './order-filters';
import { testOrderSql } from './order-kinds';

/** WHERE de la lista de pedidos del admin; lo comparten la tabla y el CSV. */
export function orderConditions(filters: OrderFilters): SQL | undefined {
  const conditions: SQL[] = [];
  if (filters.productId) {
    // EXISTS keeps mixed orders unique, even when several variants match.
    conditions.push(exists(db.select({ id: orderItems.id }).from(orderItems).where(and(
      eq(orderItems.orderId, orders.id), eq(orderItems.productId, filters.productId),
    ))));
  }
  if (filters.categoryId) {
    // Pedidos con al menos un producto de la categoría (o sin categoría).
    conditions.push(exists(db.select({ id: orderItems.id }).from(orderItems)
      .innerJoin(products, eq(products.id, orderItems.productId))
      .where(and(
        eq(orderItems.orderId, orders.id),
        filters.categoryId === NO_CATEGORY ? isNull(products.categoryId) : eq(products.categoryId, filters.categoryId),
      ))));
  }
  if (filters.from) {
    conditions.push(gte(orders.createdAt, sql`${filters.from}::date::timestamp AT TIME ZONE 'America/Mexico_City'`));
  }
  if (filters.to) {
    // Exclusive next-day boundary includes every instant of the selected last day.
    conditions.push(lt(orders.createdAt, sql`(${filters.to}::date + 1)::timestamp AT TIME ZONE 'America/Mexico_City'`));
  }
  if (filters.kind === 'pruebas') conditions.push(testOrderSql);
  if (filters.kind === 'reales') conditions.push(not(testOrderSql));
  return conditions.length ? and(...conditions) : undefined;
}
