import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '../db';
import { orderItems, orders } from '../db/schema';
import { MONDAY_DEFINITIONS as definitions, buildInitialMondayJobs, type MondayJobKey as JobKey } from './jobs';
import type { MondayJob, MondayJobOptions, MondayOrder, MondayItem } from './shared';
import { createMondayClient } from './client';
import { deliverMondayOrder, mondayJobDue, MAX_MONDAY_ATTEMPTS, type MondayDeliveryStore } from './delivery';

function jobOptions(prefix: string): MondayJobOptions {
  return {
    boardId: process.env[`${prefix}_BOARD_ID`]?.trim() || undefined,
    groupId: process.env[`${prefix}_GROUP_ID`]?.trim() || undefined,
    productId: process.env[`${prefix}_PRODUCT_ID`]?.trim() || undefined,
    syncTestOrders: process.env.MONDAY_SYNC_TEST_ORDERS?.trim() === 'true',
  };
}

export function initialMondayJobs(order: MondayOrder, items: MondayItem[]): Partial<Record<JobKey, MondayJob>> {
  return buildInitialMondayJobs(order, items, Object.fromEntries(
    definitions.map((definition) => [definition.key, jobOptions(definition.envPrefix)]),
  ));
}

function deliveryStore(key: JobKey): MondayDeliveryStore {
  return {
    async claim(orderId) {
      return db.transaction(async (tx) => {
        const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
        if (!order || !['paid', 'fulfilled'].includes(order.status)) return null;
        const metadata = (order.metadata ?? {}) as Record<string, unknown>;
        const current = metadata[key] as MondayJob | undefined;
        if (!current || !mondayJobDue(current)) return null;
        const job: MondayJob = {
          ...current, status: 'processing', claimId: randomUUID(),
          startedAt: new Date().toISOString(), attempts: current.attempts + 1,
        };
        await tx.update(orders).set({
          metadata: { ...metadata, [key]: job }, updatedAt: new Date(),
        }).where(eq(orders.id, orderId));
        const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId)).orderBy(asc(orderItems.id));
        return { order, items, job };
      });
    },
    async finish(orderId, claimId, job) {
      // Update only this product's job, preserving the other board's independent state.
      await db.update(orders).set({
        metadata: sql`jsonb_set(${orders.metadata}, ARRAY[${key}]::text[], ${JSON.stringify(job)}::text::jsonb)`,
        updatedAt: new Date(),
      }).where(and(eq(orders.id, orderId), sql`${orders.metadata}->${key}->>'claimId' = ${claimId}`));
    },
  };
}

async function syncJob(orderId: string, key: JobKey) {
  const token = process.env.MONDAY_API_TOKEN?.trim();
  if (!token) return 'unconfigured' as const;
  try {
    return await deliverMondayOrder(orderId, deliveryStore(key), createMondayClient(token));
  } catch {
    console.error(`[monday:${key}] No se pudo procesar el pedido ${orderId}; se conserva para reintento.`);
    return 'failed' as const;
  }
}

/** Each board has its own claim, item ID, retry counter and duplicate check. */
export async function syncMondayOrder(orderId: string) {
  return Promise.all(definitions.map((definition) => syncJob(orderId, definition.key)));
}

export async function retryMondaySync() {
  if (!process.env.MONDAY_API_TOKEN?.trim()) return { configured: false, sent: 0, failed: 0 };
  const candidates = await db.select({ id: orders.id, metadata: orders.metadata }).from(orders)
    .where(and(
      inArray(orders.status, ['paid', 'fulfilled']),
      or(...definitions.map(({ key }) => sql`(
        ${orders.metadata}->${key}->>'status' IN ('pending', 'processing', 'failed')
        AND COALESCE((${orders.metadata}->${key}->>'attempts')::int, 0) < ${MAX_MONDAY_ATTEMPTS}
      )`)),
    )).orderBy(asc(orders.updatedAt)).limit(100);
  const due = candidates.flatMap((row) => definitions.flatMap(({ key }) => {
    const job = (row.metadata as Record<string, MondayJob>)[key];
    return job && mondayJobDue(job) ? [{ orderId: row.id, key }] : [];
  })).slice(0, 10);
  let sent = 0;
  let failed = 0;
  // Keep the existing hourly cron bounded while allowing each board to progress.
  for (let index = 0; index < due.length; index += 2) {
    const results = await Promise.all(due.slice(index, index + 2).map((job) => syncJob(job.orderId, job.key)));
    sent += results.filter((result) => result === 'sent').length;
    failed += results.filter((result) => result === 'failed').length;
  }
  return { configured: true, processed: due.length, sent, failed };
}
