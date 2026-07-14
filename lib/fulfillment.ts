import { randomBytes } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from './db';
import { config } from './config';
import { formatMoney } from './money';
import { sendOrderConfirmation } from './email';
import {
  digitalAssets,
  discountCodes,
  downloadGrants,
  orderItems,
  orders,
  productVariants,
} from './db/schema';

type FulfillMeta = {
  paymentIntentId?: string | null;
  customerId?: string | null;
};

/**
 * Finaliza un pedido tras confirmarse el pago. Idempotente: si el pedido ya
 * está pagado, no hace nada. Todo ocurre en una transacción.
 */
export async function fulfillOrder(orderId: string, meta: FulfillMeta = {}): Promise<void> {
  const downloadLinks = await db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)
      .for('update');

    if (!order) throw new Error(`Pedido ${orderId} no encontrado`);
    if (order.status !== 'pending') {
      return null; // ya procesado → idempotente
    }

    await tx
      .update(orders)
      .set({
        status: 'paid',
        paidAt: new Date(),
        externalPaymentIntentId: meta.paymentIntentId ?? order.externalPaymentIntentId,
        externalCustomerId: meta.customerId ?? order.externalCustomerId,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));

    // 1) Descontar stock de físicos (guardado contra sobreventa).
    for (const item of items) {
      if (item.type === 'physical' && item.variantId) {
        await tx
          .update(productVariants)
          .set({ stock: sql`GREATEST(${productVariants.stock} - ${item.quantity}, 0)` })
          .where(
            and(
              eq(productVariants.id, item.variantId),
              eq(productVariants.trackInventory, true),
            ),
          );
      }
    }

    // 2) Generar permisos de descarga de digitales.
    const links: { name: string; url: string }[] = [];
    for (const item of items) {
      if (item.type !== 'digital' || !item.productId) continue;
      const assets = await tx
        .select()
        .from(digitalAssets)
        .where(eq(digitalAssets.productId, item.productId));

      for (const asset of assets) {
        const token = randomBytes(24).toString('hex');
        await tx.insert(downloadGrants).values({
          orderId,
          orderItemId: item.id,
          digitalAssetId: asset.id,
          token,
          downloadLimit: asset.downloadLimit,
        });
        links.push({ name: asset.fileName, url: `${config.appUrl}/api/descargas/${token}` });
      }
    }

    // 3) Contar redención del cupón.
    if (order.discountCode) {
      await tx
        .update(discountCodes)
        .set({ timesRedeemed: sql`${discountCodes.timesRedeemed} + 1` })
        .where(eq(discountCodes.code, order.discountCode));
    }

    return {
      email: order.customerEmail,
      number: order.number,
      totalLabel: formatMoney(Math.round(parseFloat(order.totalAmount) * 100), order.currency),
      links,
    };
  });

  if (downloadLinks) {
    await sendOrderConfirmation({
      to: downloadLinks.email,
      orderNumber: downloadLinks.number,
      totalLabel: downloadLinks.totalLabel,
      downloadLinks: downloadLinks.links,
    });
  }
}
