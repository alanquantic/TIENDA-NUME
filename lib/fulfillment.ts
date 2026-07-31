import { randomBytes } from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from './db';
import { config } from './config';
import { sendOrderConfirmation, sendOrderFailed } from './email';
import type { EmailAddress } from './email-templates';
import { isReportGeneratorConfigured, submitReport } from './report-generator';
import { reportEngineForKey, type ReportEngine, type ReportKey } from './report-catalog';
import {
  GROUP_EMAIL_NOTE,
  groupForProduct,
  hasExternalHook,
  type ProductGroup,
} from './product-groups';
import {
  notifyExternalPurchase,
  type ExternalHookKind,
  type ItemLike,
} from './external-hooks';
import {
  categories,
  digitalAssets,
  discountCodes,
  downloadGrants,
  generatedReports,
  orderItems,
  orders,
  productVariants,
  products,
} from './db/schema';

type ReportMeta = {
  key: ReportKey;
  kind?: 'generated' | 'static';
  engine?: ReportEngine;
  label?: string;
  person?: { name: string; birthDate: string } | null;
  partner?: { name: string; birthDate: string } | null;
  variant?: string | null;
};

type StoredReportInput = {
  kind: 'generated' | 'static';
  engine: ReportEngine;
  person: ReportMeta['person'];
  partner: ReportMeta['partner'];
  variant: string | null;
  instance: string;
  jobId?: string | null;
  previewUrl?: string | null;
  jsonUrl?: string | null;
};

function reportMetasOf(metadata: unknown): ReportMeta[] {
  const meta = metadata as { report?: ReportMeta; reports?: ReportMeta[] } | null;
  if (meta?.reports?.length) return meta.reports;
  if (meta?.report) return [meta.report];
  return [];
}

async function generateReportsForOrder(
  orderId: string,
  items: { id: string; name: string; metadata: unknown }[],
): Promise<{ reportLinks: { name: string; url: string }[]; pendingAiReports: { name: string }[] }> {
  const reportLinks: { name: string; url: string }[] = [];
  const pendingAiReports: { name: string }[] = [];

  for (const item of items) {
    for (const meta of reportMetasOf(item.metadata)) {
      const displayName = meta.label ?? item.name;
      const instance = item.id.replace(/-/g, '').slice(0, 12);
      const engine = meta.engine ?? reportEngineForKey(meta.key);
      const storedInput: StoredReportInput = {
        kind: meta.kind ?? 'generated',
        engine,
        person: meta.person ?? null,
        partner: meta.partner ?? null,
        variant: meta.variant ?? null,
        instance,
      };

      await db
        .insert(generatedReports)
        .values({
          orderId,
          orderItemId: item.id,
          reportKey: meta.key,
          productName: displayName,
          status: 'pending',
          input: storedInput,
        })
        .onConflictDoNothing({
          target: [
            generatedReports.orderId,
            generatedReports.orderItemId,
            generatedReports.reportKey,
          ],
        });

      const whereReport = and(
        eq(generatedReports.orderId, orderId),
        eq(generatedReports.orderItemId, item.id),
        eq(generatedReports.reportKey, meta.key),
      );
      const [existingRow] = await db
        .select({ id: generatedReports.id })
        .from(generatedReports)
        .where(whereReport)
        .limit(1);

      if (!isReportGeneratorConfigured()) {
        await db
          .update(generatedReports)
          .set({ status: 'skipped', error: 'Generador no configurado', updatedAt: new Date() })
          .where(whereReport);
        continue;
      }

      try {
        const result = await submitReport({
          orderId,
          report: meta.key,
          variant: meta.variant ?? undefined,
          person: meta.person ?? undefined,
          partner: meta.partner ?? undefined,
          instance,
          notify: existingRow ? { reportRowId: existingRow.id } : undefined,
        });

        if (result.mode === 'legacy') {
          await db
            .update(generatedReports)
            .set({ status: 'ready', url: result.url, error: null, updatedAt: new Date() })
            .where(whereReport);
          reportLinks.push({ name: displayName, url: result.url });
          continue;
        }

        pendingAiReports.push({ name: displayName });
        await db
          .update(generatedReports)
          .set({
            status: result.status,
            error: null,
            input: { ...storedInput, jobId: result.jobId },
            updatedAt: new Date(),
          })
          .where(whereReport);
      } catch (error) {
        console.error(`[reportes] fallo ${meta.key} del pedido ${orderId}:`, error);
        await db
          .update(generatedReports)
          .set({ status: 'error', error: String(error), updatedAt: new Date() })
          .where(whereReport);
      }
    }
  }

  return { reportLinks, pendingAiReports };
}

type ProductInfo = { slug: string; categorySlug: string | null };

async function productInfoFor(
  items: { productId: string | null }[],
): Promise<Map<string, ProductInfo>> {
  const ids = [...new Set(items.map((item) => item.productId).filter((value): value is string => !!value))];
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: products.id, slug: products.slug, categorySlug: categories.slug })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(inArray(products.id, ids));
  return new Map(rows.map((row) => [row.id, { slug: row.slug, categorySlug: row.categorySlug }]));
}

type FulfillMeta = {
  paymentIntentId?: string | null;
  customerId?: string | null;
};

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
      return null;
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

    if (order.discountCode) {
      await tx
        .update(discountCodes)
        .set({ timesRedeemed: sql`${discountCodes.timesRedeemed} + 1` })
        .where(eq(discountCodes.code, order.discountCode));
    }

    return { order, items, links };
  });

  if (!result) return;

  const { order, items, links } = result;
  const { reportLinks, pendingAiReports } = await generateReportsForOrder(order.id, items);

  const info = await productInfoFor(items);
  const groupOf = (productId: string | null): ProductGroup | null => {
    const productInfo = productId ? info.get(productId) : undefined;
    return productInfo ? groupForProduct(productInfo.slug, productInfo.categorySlug) : null;
  };

  const notes: string[] = [];
  const seen = new Set<ProductGroup>();
  for (const item of items) {
    const group = groupOf(item.productId);
    if (!group || seen.has(group)) continue;
    seen.add(group);
    const note = GROUP_EMAIL_NOTE[group];
    if (note) notes.push(note);
  }

  await sendOrderConfirmation({
    number: order.number,
    customerName: `${order.customerFirstName ?? ''} ${order.customerLastName ?? ''}`.trim(),
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    currency: order.currency,
    items: items.map((item) => ({
      name: item.name,
      variantName: item.variantName,
      quantity: item.quantity,
      totalAmount: item.totalAmount,
      type: item.type,
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
    pendingReports: pendingAiReports,
    notes,
  });

  const toItemLike = (item: (typeof items)[number]): ItemLike => ({
    slug: item.productId ? (info.get(item.productId)?.slug ?? null) : null,
    name: item.name,
    variantName: item.variantName,
    sku: item.sku,
    type: item.type,
    quantity: item.quantity,
    unitAmount: item.unitAmount,
    totalAmount: item.totalAmount,
  });
  const allItems = items.map(toItemLike);

  const byGroup = new Map<ExternalHookKind, ItemLike[]>();
  for (const item of items) {
    const group = groupOf(item.productId);
    if (!group || !hasExternalHook(group)) continue;
    const list = byGroup.get(group) ?? [];
    list.push(toItemLike(item));
    byGroup.set(group, list);
  }

  for (const [kind, triggerItems] of byGroup) {
    await notifyExternalPurchase({
      kind,
      order: { ...order, paidAt: order.paidAt ?? new Date() },
      items: allItems,
      triggerItems,
    });
  }
}

export async function notifyOrderFailed(orderId: string): Promise<void> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  await sendOrderFailed({
    number: order.number,
    customerName: `${order.customerFirstName ?? ''} ${order.customerLastName ?? ''}`.trim(),
    customerEmail: order.customerEmail,
    currency: order.currency,
    items: items.map((item) => ({
      name: item.name,
      variantName: item.variantName,
      quantity: item.quantity,
      totalAmount: item.totalAmount,
      type: item.type,
    })),
    totalAmount: order.totalAmount,
  });
}
