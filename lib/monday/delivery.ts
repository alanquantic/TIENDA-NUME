import { buildAgenda2027Payload } from './agenda-2027';
import { buildNumerathumPayload, NUMERATHUM_ORDER_COLUMN } from './numerathum';
import { buildLibroPayload } from './libro';
import type { MondayItem, MondayOrder, MondayJob } from './shared';
import { MondayError, type MondayClient } from './client';

export const MAX_MONDAY_ATTEMPTS = 8;
export const MONDAY_LEASE_MS = 5 * 60_000;

export function mondayJobDue(job: MondayJob, now = Date.now()): boolean {
  if (job.status === 'sent' || job.status === 'skipped' || job.attempts >= MAX_MONDAY_ATTEMPTS) return false;
  if (job.status === 'processing') {
    return !job.startedAt || new Date(job.startedAt).getTime() + MONDAY_LEASE_MS <= now;
  }
  return !job.nextAttemptAt || new Date(job.nextAttemptAt).getTime() <= now;
}

export type MondayDeliveryStore = {
  // Claim must be atomic: two payment notifications must never send simultaneously.
  claim(orderId: string): Promise<{ order: MondayOrder; items: MondayItem[]; job: MondayJob } | null>;
  finish(orderId: string, claimId: string, job: MondayJob): Promise<void>;
};

function safeError(error: unknown): string {
  if (error instanceof MondayError) return error.code;
  if (error instanceof Error && /^[a-z][a-z0-9-]{0,99}$/.test(error.message)) return error.message;
  return 'monday-request-failed';
}

/** This worker never turns a CRM outage into a failed customer payment. */
export async function deliverMondayOrder(orderId: string, store: MondayDeliveryStore, client: MondayClient) {
  const claimed = await store.claim(orderId);
  if (!claimed) return 'idle' as const;
  const { order, items, job } = claimed;
  try {
    const isNumerathum = job.kind === 'numerathum';
    const existing = await client.inspectOrder(job.boardId, order.number, isNumerathum ? NUMERATHUM_ORDER_COLUMN : 'texto');
    let itemId = existing.itemId;
    if (!itemId) {
      const payload = isNumerathum
        ? buildNumerathumPayload(order, items, { productId: job.productId })
        : job.kind === 'libro'
        ? buildLibroPayload(order, items, { productId: job.productId, postalColumnType: existing.postalColumnType })
        : buildAgenda2027Payload(order, items, { productId: job.productId, postalColumnType: existing.postalColumnType });
      itemId = await client.createPurchaseItem({ boardId: job.boardId, groupId: job.groupId, orderId, payload, kind: job.kind });
    }
    await store.finish(orderId, job.claimId!, {
      ...job, status: 'sent', itemId, sentAt: new Date().toISOString(), error: undefined,
      claimId: undefined, startedAt: undefined, nextAttemptAt: undefined,
    });
    return 'sent' as const;
  } catch (error) {
    const delay = Math.min(5 * 60_000 * 2 ** (job.attempts - 1), 60 * 60_000);
    await store.finish(orderId, job.claimId!, {
      ...job, status: 'failed', error: safeError(error),
      nextAttemptAt: new Date(Date.now() + delay).toISOString(),
      claimId: undefined, startedAt: undefined,
    });
    return 'failed' as const;
  }
}
