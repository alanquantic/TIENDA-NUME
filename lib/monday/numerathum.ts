import { fromMinorToDecimalString } from '../money';
import {
  initialProductJob, productPaidMinor, purchaseDate,
  type MondayOrder, type MondayItem, type MondayPayload, type MondayJobOptions,
} from './shared';

export const LEGACY_NUMERATHUM_PRODUCT_ID = '44759e92-c983-41f8-8ff4-c9e972d3bebb';
export const NUMERATHUM_PRODUCT_ID = 'bd660507-5d23-4451-a261-888bd8a5621e';
export const NUMERATHUM_BOARD_ID = '18379779965';
export const NUMERATHUM_GROUP_ID = 'group_mkxprje7';
export const NUMERATHUM_JOB_KEY = 'mondayNumerathum';
export const NUMERATHUM_ORDER_COLUMN = '__pedido_web';

// IDs verificados en la categoría planes-numerathum y opciones PLAN del tablero.
export const MONDAY_NUMERATHUM_PLANS = [
  { productId: NUMERATHUM_PRODUCT_ID, slug: 'numerathum-oraculo-365', planIndex: 0,
    jobKey: NUMERATHUM_JOB_KEY, productIdEnv: 'MONDAY_NUMERATHUM_ORACULO_PRODUCT_ID' },
  { productId: '872042a8-b6b6-472d-bca4-cdcd99d98a2c', slug: 'numerathum-espejo', planIndex: 13,
    jobKey: 'mondayNumerathumEspejo', productIdEnv: 'MONDAY_NUMERATHUM_ESPEJO_PRODUCT_ID' },
  { productId: '47f6d348-edc7-4971-8c6a-f2eb3ff3a640', slug: 'numerathum-horizonte-60', planIndex: 4,
    jobKey: 'mondayNumerathumHorizonte', productIdEnv: 'MONDAY_NUMERATHUM_HORIZONTE_PRODUCT_ID' },
] as const;

export function numerathumProductId(plan: typeof MONDAY_NUMERATHUM_PLANS[number]) {
  return process.env[plan.productIdEnv]?.trim() || plan.productId;
}

function planForProduct(productId: string) {
  // Los IDs originales siguen reconociéndose para trabajos ya encolados.
  return MONDAY_NUMERATHUM_PLANS.find((plan) =>
    plan.productId === productId || numerathumProductId(plan) === productId);
}

export function numerathumOrderReference(orderNumber: string, productId: string) {
  const plan = planForProduct(productId);
  // Conserva la referencia de trabajos antiguos que ya estaban encolados.
  return plan ? `${orderNumber}:${plan.slug}` : orderNumber;
}

export function initialNumerathumJob(
  order: MondayOrder, items: MondayItem[], options: MondayJobOptions = {},
  productId = numerathumProductId(MONDAY_NUMERATHUM_PLANS[0]),
) {
  if (productId === LEGACY_NUMERATHUM_PRODUCT_ID || !planForProduct(productId)) return null;
  return initialProductJob(order, items, {
    productId,
    boardId: options.boardId ?? NUMERATHUM_BOARD_ID,
    groupId: options.groupId ?? NUMERATHUM_GROUP_ID,
    kind: 'numerathum', syncTestOrders: options.syncTestOrders,
  });
}

function birthParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error('invalid-numerathum-birth-date');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(0);
  check.setUTCFullYear(year, month - 1, day);
  if (year < 1 || check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) {
    throw new Error('invalid-numerathum-birth-date');
  }
  return { year, month, day };
}

export function buildNumerathumPayload(order: MondayOrder, items: MondayItem[], options: {
  productId?: string;
} = {}): MondayPayload {
  if (!['paid', 'fulfilled'].includes(order.status) || !order.paidAt) throw new Error('order-not-paid');
  if (order.currency.toUpperCase() !== 'MXN') throw new Error('numerathum-board-requires-mxn');
  const productId = options.productId ?? numerathumProductId(MONDAY_NUMERATHUM_PLANS[0]);
  const plan = planForProduct(productId);
  if (!plan && productId !== LEGACY_NUMERATHUM_PRODUCT_ID) throw new Error('unknown-numerathum-plan');
  if (!items.some((item) => item.productId === productId)) throw new Error('order-has-no-numerathum');
  const amount = fromMinorToDecimalString(productPaidMinor(order, items, productId));
  const address = (order.shippingAddress ?? {}) as { country?: string; phone?: string };
  const phone = order.customerPhone?.trim() || address.phone?.trim();
  const columns: MondayPayload['columns'] = {
    mm: { ids: [27] }, // ALAN is a dropdown here, with a different ID than Agenda 2027.
    color_mkxpqbfg: { index: plan?.planIndex ?? 0 },
    texto33: order.customerEmail,
    date_mkxpn5yf: { date: purchaseDate(order.paidAt) },
    numbers1: amount,
    n_meros: amount, // Confirmed paid in full; other products and shipping excluded.
    [NUMERATHUM_ORDER_COLUMN]: numerathumOrderReference(order.number, productId),
  };
  // Checkout stores surnames together. Never guess where a compound surname splits.
  if (order.customerLastName?.trim()) columns.texto0 = order.customerLastName.trim();
  if (phone) columns.phone1 = { phone, countryShortName: address.country?.toUpperCase() || 'MX' };
  if (order.provider === 'paypal') columns.status2 = { index: 2 };
  // Birthday is optional at checkout; absent dates stay empty rather than invented.
  if (order.customerBirthDate) {
    const { year, month, day } = birthParts(order.customerBirthDate);
    columns.texto3 = day;
    columns.texto92 = { ids: [month] };
    columns.texto1 = year;
  }
  return {
    name: order.customerFirstName?.trim() || order.customerEmail,
    orderNumber: numerathumOrderReference(order.number, productId),
    columns,
  };
}
