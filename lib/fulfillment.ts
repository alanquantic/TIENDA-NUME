import { randomBytes } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from './db';
import { config } from './config';
import { sendOrderConfirmation, sendOrderFailed } from './email';
import type { EmailAddress } from './email-templates';
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
  const result = await db.transaction(async (tx) => {
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

    return { order, items, links };
  });

  if (result) {
    const { order, items, links } = result;
    await sendOrderConfirmation({
      number: order.number,
      customerName: `${order.customerFirstName ?? ''} ${order.customerLastName ?? ''}`.trim(),
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      currency: order.currency,
      items: items.map((i) => ({
        name: i.name,
        variantName: i.variantName,
        quantity: i.quantity,
        totalAmount: i.totalAmount,
        type: i.type,
      })),
      subtotalAmount: order.subtotalAmount,
      discountAmount: order.discountAmount,
      discountCode: order.discountCode,
      shippingAmount: order.shippingAmount,
      taxAmount: order.taxAmount,
      totalAmount: order.totalAmount,
      requiresShipping: order.requiresShipping,
      shippingMethod: order.shippingMethod,
      shippingAddress: (order.shippingAddress as EmailAddress | null) ?? null,
      downloads: links,
    });
  }
}

/**
 * Envía el correo de "compra no completada" para un pedido. Llamar cuando el
 * pago falla o la sesión de pago expira (webhook de la pasarela).
 */
export async function notifyOrderFailed(orderId: string): Promise<void> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  await sendOrderFailed({
    number: order.number,
    customerName: `${order.customerFirstName ?? ''} ${order.customerLastName ?? ''}`.trim(),
    customerEmail: order.customerEmail,
    currency: order.currency,
    items: items.map((i) => ({
      name: i.name,
      variantName: i.variantName,
      quantity: i.quantity,
      totalAmount: i.totalAmount,
      type: i.type,
    })),
    totalAmount: order.totalAmount,
  });
}
