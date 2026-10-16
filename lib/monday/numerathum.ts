import { fromMinorToDecimalString } from '../money';
import {
  initialProductJob, productPaidMinor, purchaseDate,
  type MondayOrder, type MondayItem, type MondayPayload, type MondayJobOptions,
} from './shared';

export const NUMERATHUM_PRODUCT_ID = '44759e92-c983-41f8-8ff4-c9e972d3bebb';
export const NUMERATHUM_BOARD_ID = '18379779965';
export const NUMERATHUM_GROUP_ID = 'group_mkxprje7';
export const NUMERATHUM_JOB_KEY = 'mondayNumerathum';
export const NUMERATHUM_ORDER_COLUMN = '__pedido_web';

export function initialNumerathumJob(order: MondayOrder, items: MondayItem[], options: MondayJobOptions = {}) {
  return initialProductJob(order, items, {
    productId: options.productId ?? NUMERATHUM_PRODUCT_ID,
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
  const productId = options.productId ?? NUMERATHUM_PRODUCT_ID;
  if (!items.some((item) => item.productId === productId)) throw new Error('order-has-no-numerathum');
  const amount = fromMinorToDecimalString(productPaidMinor(order, items, productId));
  const address = (order.shippingAddress ?? {}) as { country?: string; phone?: string };
  const phone = order.customerPhone?.trim() || address.phone?.trim();
  const columns: MondayPayload['columns'] = {
    mm: { ids: [27] }, // ALAN is a dropdown here, with a different ID than Agenda 2027.
    color_mkxpqbfg: { index: 0 }, // ORACULO.
    texto33: order.customerEmail,
    date_mkxpn5yf: { date: purchaseDate(order.paidAt) },
    numbers1: amount,
    n_meros: amount, // Confirmed paid in full; other products and shipping excluded.
    [NUMERATHUM_ORDER_COLUMN]: order.number,
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
    orderNumber: order.number,
    columns,
  };
}
