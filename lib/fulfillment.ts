import { randomBytes } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from './db';
import { config } from './config';
import { sendOrderConfirmation, sendOrderFailed } from './email';
import type { EmailAddress } from './email-templates';
import { generateReport, isReportGeneratorConfigured } from './report-generator';
import type { ReportKey } from './report-catalog';
import {
  digitalAssets,
  discountCodes,
  downloadGrants,
  generatedReports,
  orderItems,
  orders,
  productVariants,
} from './db/schema';

type ReportMeta = {
  key: ReportKey;
  /** 'generated' → lleva person/partner; 'static' → PDF pre-hecho (+ variant). */
  kind?: 'generated' | 'static';
  /** Nombre a mostrar (distingue los reportes de un bundle). */
  label?: string;
  person?: { name: string; birthDate: string } | null;
  partner?: { name: string; birthDate: string } | null;
  /** Color elegido para estáticos con versiones (agenda 2025). */
  variant?: string | null;
};

/**
 * Reportes de un ítem. Acepta el formato nuevo (`reports: []`, un producto
 * puede entregar varios) y el antiguo (`report: {}`) de pedidos previos.
 */
function reportMetasOf(metadata: unknown): ReportMeta[] {
  const m = metadata as { report?: ReportMeta; reports?: ReportMeta[] } | null;
  if (m?.reports?.length) return m.reports;
  if (m?.report) return [m.report];
  return [];
}

async function generateReportsForOrder(
  orderId: string,
  items: { name: string; metadata: unknown }[],
): Promise<{ name: string; url: string }[]> {
  const reportLinks: { name: string; url: string }[] = [];
  // Los reportes son únicos por pedido: si dos productos comparten una clave
  // (Membresía y Kit → reporte-quien-soy) se genera y se enlista una sola vez.
  // El generador guarda en md5(order_id)/<clave>.pdf: repetir la clave en el
  // mismo pedido sobrescribiría el mismo archivo.
  const done = new Set<string>();
  for (const item of items) {
    for (const meta of reportMetasOf(item.metadata)) {
      if (done.has(meta.key)) continue;
      done.add(meta.key);
      const displayName = meta.label ?? item.name;

      await db
        .insert(generatedReports)
        .values({
          orderId,
          reportKey: meta.key,
          productName: displayName,
          status: 'pending',
          input: {
            kind: meta.kind ?? 'generated',
            person: meta.person ?? null,
            partner: meta.partner ?? null,
            variant: meta.variant ?? null,
          },
        })
        .onConflictDoNothing({
          target: [generatedReports.orderId, generatedReports.reportKey],
        });

      const whereReport = and(
        eq(generatedReports.orderId, orderId),
        eq(generatedReports.reportKey, meta.key),
      );

      if (!isReportGeneratorConfigured()) {
        await db
          .update(generatedReports)
          .set({ status: 'skipped', error: 'Generador no configurado', updatedAt: new Date() })
          .where(whereReport);
        continue;
      }

      try {
        const { url } = await generateReport({
          orderId,
          report: meta.key,
          variant: meta.variant ?? undefined,
          person: meta.person ?? undefined,
          partner: meta.partner ?? undefined,
        });
        await db
          .update(generatedReports)
          .set({ status: 'ready', url, error: null, updatedAt: new Date() })
          .where(whereReport);
        reportLinks.push({ name: displayName, url });
      } catch (e) {
        console.error(`[reportes] falló ${meta.key} del pedido ${orderId}:`, e);
        await db
          .update(generatedReports)
          .set({ status: 'error', error: String(e), updatedAt: new Date() })
          .where(whereReport);
      }
    }
  }
  return reportLinks;
}

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
    // Genera los reportes (llamadas externas, fuera de la transacción).
    const reportLinks = await generateReportsForOrder(order.id, items);
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
      reports: reportLinks,
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
