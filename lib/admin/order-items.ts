import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import { categories, generatedReports, orderItems, products, type OrderItem } from '../db/schema';
import { itemKind, type ItemKind } from './order-kinds';

export type AdminOrderItem = OrderItem & {
  kind: ItemKind;
  categoryName: string | null;
};

/** Ítems de los pedidos con su tipo (Reporte IA, Membresía…) y categoría. */
export async function itemsForOrders(orderIds: string[]): Promise<Map<string, AdminOrderItem[]>> {
  const byOrder = new Map<string, AdminOrderItem[]>();
  if (orderIds.length === 0) return byOrder;

  const [rows, engines] = await Promise.all([
    db
      .select({
        item: orderItems,
        slug: products.slug,
        categorySlug: categories.slug,
        categoryName: categories.name,
      })
      .from(orderItems)
      .leftJoin(products, eq(products.id, orderItems.productId))
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .where(inArray(orderItems.orderId, orderIds)),
    db
      .select({
        orderItemId: generatedReports.orderItemId,
        engine: sql<string | null>`${generatedReports.input}->>'engine'`,
      })
      .from(generatedReports)
      .where(inArray(generatedReports.orderId, orderIds)),
  ]);

  const enginesByItem = new Map<string, string[]>();
  for (const row of engines) {
    if (!row.orderItemId || !row.engine) continue;
    enginesByItem.set(row.orderItemId, [...(enginesByItem.get(row.orderItemId) ?? []), row.engine]);
  }

  for (const row of rows) {
    const list = byOrder.get(row.item.orderId) ?? [];
    list.push({
      ...row.item,
      categoryName: row.categoryName,
      kind: itemKind({
        slug: row.slug,
        categorySlug: row.categorySlug,
        type: row.item.type,
        reportEngines: enginesByItem.get(row.item.id),
      }),
    });
    byOrder.set(row.item.orderId, list);
  }
  return byOrder;
}

/** Tipos distintos de un pedido, en orden de aparición. */
export function distinctKinds(items: AdminOrderItem[]): ItemKind[] {
  return [...new Set(items.map((item) => item.kind))];
}
