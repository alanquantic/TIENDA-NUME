import { buildAgenda2027Payload } from './agenda-2027';
import { buildAgenda2026Payload } from './agenda-2026';
import { buildNumerathumPayload, numerathumOrderReference, NUMERATHUM_ORDER_COLUMN } from './numerathum';
import { buildLibroPayload } from './libro';
import { buildArithmaxPayload, arithmaxOrderReference, ARITHMAX_ORDER_COLUMN } from './arithmax';
import { buildCoursePayload, courseOrderReference, COURSES_ORDER_COLUMN } from './courses';
import { buildReportPayload, reportOrderReference, REPORTS_ORDER_COLUMN } from './reports';
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
    const isArithmax = job.kind === 'arithmax';
    const isCourse = job.kind === 'course';
    const isReport = job.kind === 'report';
    const reference = isNumerathum ? numerathumOrderReference(order.number, job.productId)
      : isArithmax ? arithmaxOrderReference(order.number, job.productId)
      : isCourse ? courseOrderReference(order.number, job.productId)
      : isReport ? reportOrderReference(order.number, job.productId) : order.number;
    const orderColumn = isNumerathum ? NUMERATHUM_ORDER_COLUMN : isArithmax ? ARITHMAX_ORDER_COLUMN
      : isCourse ? COURSES_ORDER_COLUMN : isReport ? REPORTS_ORDER_COLUMN : 'texto';
    const existing = await client.inspectOrder(job.boardId, reference, orderColumn);
    let itemId = existing.itemId;
    if (!itemId) {
      const payload = isNumerathum
        ? buildNumerathumPayload(order, items, { productId: job.productId })
        : isArithmax
        ? buildArithmaxPayload(order, items, { productId: job.productId })
        : isCourse
        ? buildCoursePayload(order, items, { productId: job.productId })
        : isReport
        ? buildReportPayload(order, items, { productId: job.productId })
        : job.kind === 'libro'
        ? buildLibroPayload(order, items, { productId: job.productId, postalColumnType: existing.postalColumnType })
        : job.kind === 'agenda-2026'
        ? buildAgenda2026Payload(order, items, { productId: job.productId, postalColumnType: existing.postalColumnType })
        : buildAgenda2027Payload(order, items, { productId: job.productId, postalColumnType: existing.postalColumnType });
      itemId = await client.createPurchaseItem({
        boardId: job.boardId, groupId: job.groupId, orderId, payload, kind: job.kind,
        idempotencySuffix: reference !== order.number ? job.productId : undefined,
      });
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
