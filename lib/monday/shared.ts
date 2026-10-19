import type { Order, OrderItem } from '../db/schema';
import { toMinor } from '../money';

export type MondayOrder = Pick<Order,
  'id' | 'number' | 'status' | 'paidAt' | 'currency' | 'customerFirstName' |
  'customerLastName' | 'customerEmail' | 'customerPhone' | 'shippingAddress' |
  'totalAmount' | 'shippingAmount' | 'metadata' | 'externalPaymentIntentId' | 'provider'
> & { customerBirthDate?: string | null };
export type MondayItem = Pick<OrderItem, 'productId' | 'variantName' | 'quantity' | 'totalAmount'>;
export type MondayColumns = Record<string, string | number | null | { index: number } | { ids: number[] } | { date: string } | { phone: string; countryShortName: string }>;
export type MondayPayload = { name: string; orderNumber: string; columns: MondayColumns };
export type MondayKind = 'agenda-2027' | 'numerathum' | 'libro';

export type MondayJob = {
  // Optional to keep previously queued Agenda 2027 jobs compatible.
  kind?: MondayKind;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'skipped';
  boardId: string;
  groupId: string;
  productId: string;
  attempts: number;
  queuedAt: string;
  nextAttemptAt?: string;
  startedAt?: string;
  claimId?: string;
  itemId?: string;
  sentAt?: string;
  error?: string;
  reason?: string;
};

export type MondayJobOptions = {
  boardId?: string; groupId?: string; productId?: string; syncTestOrders?: boolean;
};

export function initialProductJob(order: MondayOrder, items: MondayItem[], settings: {
  boardId: string; groupId: string; productId: string; kind: MondayKind; syncTestOrders?: boolean;
}): MondayJob | null {
  if (!items.some((item) => item.productId === settings.productId)) return null;
  const metadata = order.metadata as { paymentMode?: string } | null;
  const isTest = metadata?.paymentMode === 'sandbox' || order.externalPaymentIntentId?.startsWith('SIMULADO-');
  return {
    kind: settings.kind,
    status: isTest && !settings.syncTestOrders ? 'skipped' : 'pending',
    boardId: settings.boardId, groupId: settings.groupId, productId: settings.productId,
    attempts: 0, queuedAt: new Date().toISOString(),
    ...(isTest && !settings.syncTestOrders ? { reason: 'test-payment' } : {}),
  };
}

export function purchaseDate(paidAt: Date | string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(paidAt));
}

/** Allocate actual paid merchandise, excluding shipping, once across all items. */
export function productPaidMinor(order: MondayOrder, items: MondayItem[], productId: string): number {
  const paidMinor = toMinor(order.totalAmount) - toMinor(order.shippingAmount);
  const weights = items.map((item) => toMinor(item.totalAmount));
  const subtotal = weights.reduce((sum, amount) => sum + amount, 0);
  if (paidMinor < 0 || weights.some((amount) => amount < 0)) throw new Error('invalid-order-amounts');
  if (!subtotal) {
    if (paidMinor !== 0) throw new Error('invalid-order-subtotal');
    return 0;
  }
  const shares = weights.map((weight, index) => ({
    index,
    amount: Number(BigInt(paidMinor) * BigInt(weight) / BigInt(subtotal)),
    remainder: BigInt(paidMinor) * BigInt(weight) % BigInt(subtotal),
  }));
  const left = paidMinor - shares.reduce((sum, share) => sum + share.amount, 0);
  const ranked = [...shares].sort((a, b) =>
    a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1);
  for (let i = 0; i < left; i++) ranked[i].amount++;
  return shares.reduce((sum, share) => sum + (items[share.index].productId === productId ? share.amount : 0), 0);
}
