import { fromMinorToDecimalString } from '../money';
import {
  initialProductJob, productPaidMinor, purchaseDate,
  type MondayOrder, type MondayItem, type MondayPayload, type MondayJobOptions,
} from './shared';

export const ARITHMAX_BOARD_ID = '2823809976';
export const ARITHMAX_GROUP_ID = 'group_mkxprje7'; // VERSION 3.
export const ARITHMAX_ORDER_COLUMN = '__pedido_web';

// Productos y opciones LICENCIA verificados contra el catálogo y Monday.
export const MONDAY_ARITHMAX_LICENSES = [
  { productId: '55ce45a6-3cdb-43c0-a2e2-23e9a67ec5b0', slug: 'arithmax-1-ano', licenseIndex: 13,
    jobKey: 'mondayArithmax1Year', productIdEnv: 'MONDAY_ARITHMAX_1_YEAR_PRODUCT_ID' },
  { productId: '66b1fd58-0e42-4d23-a331-1f95fe8ba71a', slug: 'arithmax-3-anos', licenseIndex: 4,
    jobKey: 'mondayArithmax3Years', productIdEnv: 'MONDAY_ARITHMAX_3_YEARS_PRODUCT_ID' },
] as const;

export function arithmaxProductId(license: typeof MONDAY_ARITHMAX_LICENSES[number]) {
  return process.env[license.productIdEnv]?.trim() || license.productId;
}

function licenseForProduct(productId: string) {
  return MONDAY_ARITHMAX_LICENSES.find((license) =>
    license.productId === productId || arithmaxProductId(license) === productId);
}

export function arithmaxOrderReference(orderNumber: string, productId: string) {
  const license = licenseForProduct(productId);
  if (!license) throw new Error('unknown-arithmax-license');
  return `${orderNumber}:${license.slug}`;
}

export function initialArithmaxJob(
  order: MondayOrder, items: MondayItem[], options: MondayJobOptions = {},
  productId = arithmaxProductId(MONDAY_ARITHMAX_LICENSES[0]),
) {
  if (!licenseForProduct(productId)) return null;
  return initialProductJob(order, items, {
    productId, boardId: options.boardId ?? ARITHMAX_BOARD_ID,
    groupId: options.groupId ?? ARITHMAX_GROUP_ID,
    kind: 'arithmax', syncTestOrders: options.syncTestOrders,
  });
}

export function buildArithmaxPayload(
  order: MondayOrder, items: MondayItem[], options: { productId?: string } = {},
): MondayPayload {
  if (!['paid', 'fulfilled'].includes(order.status) || !order.paidAt) throw new Error('order-not-paid');
  if (order.currency.toUpperCase() !== 'MXN') throw new Error('arithmax-board-requires-mxn');
  const productId = options.productId ?? arithmaxProductId(MONDAY_ARITHMAX_LICENSES[0]);
  const license = licenseForProduct(productId);
  if (!license) throw new Error('unknown-arithmax-license');
  const licenseItems = items.filter((item) => item.productId === productId);
  if (!licenseItems.length) throw new Error('order-has-no-arithmax');
  if (licenseItems.some((item) => !Number.isSafeInteger(item.quantity) || item.quantity < 1)) {
    throw new Error('invalid-arithmax-quantity');
  }
  // ALAN (27), confirmado por el usuario. Solo IDs existentes en VENDEDOR.
  const seller = process.env.MONDAY_ARITHMAX_SELLER_ID?.trim() || '27';
  if (!/^(19|2[0-8])$/.test(seller)) throw new Error('invalid-arithmax-seller');
  const amount = fromMinorToDecimalString(productPaidMinor(order, items, productId));
  const reference = arithmaxOrderReference(order.number, productId);
  const columns: MondayPayload['columns'] = {
    mm: { ids: [Number(seller)] },
    color_mkxpqbfg: { index: license.licenseIndex },
    texto33: order.customerEmail,
    date_mkxpn5yf: { date: purchaseDate(order.paidAt) },
    numbers1: amount,
    n_meros: amount,
    [ARITHMAX_ORDER_COLUMN]: reference,
  };
  // El checkout captura ambos apellidos juntos; no se intenta separarlos.
  if (order.customerLastName?.trim()) columns.texto0 = order.customerLastName.trim();
  const address = (order.shippingAddress ?? {}) as { country?: string; phone?: string };
  const phone = order.customerPhone?.trim() || address.phone?.trim();
  if (phone) columns.phone1 = { phone, countryShortName: address.country?.toUpperCase() || 'MX' };
  if (order.provider === 'paypal') columns.status2 = { index: 2 };
  if (order.provider === 'mercadopago') columns.status2 = { index: 16 };
  if (order.customerBirthDate) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(order.customerBirthDate);
    if (!match) throw new Error('invalid-arithmax-birth-date');
    const [, year, month, day] = match.map(Number);
    const check = new Date(0);
    check.setUTCFullYear(year, month - 1, day);
    if (year < 1 || check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) {
      throw new Error('invalid-arithmax-birth-date');
    }
    columns.texto3 = day;
    columns.texto92 = { ids: [month] };
    columns.texto1 = year;
  }
  return { name: order.customerFirstName?.trim() || order.customerEmail, orderNumber: reference, columns };
}
