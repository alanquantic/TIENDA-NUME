import { eq } from 'drizzle-orm';
import { db } from '../db';
import { webhookEvents } from '../db/schema';
import type { PaymentMethod } from './settings';

/**
 * Bitácora de avisos de las pasarelas en `webhook_events`.
 * Devuelve null si el evento ya se procesó antes (mismo proveedor + id).
 */
export async function recordWebhookEvent(
  provider: PaymentMethod,
  eventId: string,
  eventType: string,
  payload: unknown,
): Promise<string | null> {
  const inserted = await db
    .insert(webhookEvents)
    .values({
      provider,
      eventId,
      eventType,
      status: 'pending',
      payload: (payload ?? {}) as Record<string, unknown>,
    })
    .onConflictDoNothing({ target: [webhookEvents.provider, webhookEvents.eventId] })
    .returning({ id: webhookEvents.id });
  return inserted[0]?.id ?? null;
}

export async function markWebhookEvent(
  rowId: string,
  result: { orderId?: string | null; error?: unknown },
): Promise<void> {
  await db
    .update(webhookEvents)
    .set(
      result.error
        ? {
            status: 'failed',
            relatedOrderId: result.orderId ?? null,
            error: result.error instanceof Error ? result.error.message : String(result.error),
          }
        : { status: 'processed', relatedOrderId: result.orderId ?? null, processedAt: new Date() },
    )
    .where(eq(webhookEvents.id, rowId));
}
