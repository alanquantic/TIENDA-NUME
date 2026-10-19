import { fromMinorToDecimalString, toMinor } from '../money';
import {
  initialProductJob, productPaidMinor, purchaseDate,
  type MondayOrder, type MondayItem, type MondayPayload, type MondayJobOptions,
} from './shared';

export const LIBRO_PRODUCT_ID = '753b6bc0-2e2f-4f9a-a248-4e248dc6fe4f';
export const LIBRO_BOARD_ID = '18314877163';
export const LIBRO_GROUP_ID = 'new_group';
export const LIBRO_JOB_KEY = 'mondayLibro';

export function initialLibroJob(order: MondayOrder, items: MondayItem[], options: MondayJobOptions = {}) {
  return initialProductJob(order, items, {
    productId: options.productId ?? LIBRO_PRODUCT_ID,
    boardId: options.boardId ?? LIBRO_BOARD_ID,
    groupId: options.groupId ?? LIBRO_GROUP_ID,
    kind: 'libro', syncTestOrders: options.syncTestOrders,
  });
}

function text(record: Record<string, unknown>, key: string): string {
  return typeof record[key] === 'string' ? record[key].trim() : '';
}

export function buildLibroPayload(order: MondayOrder, items: MondayItem[], options: {
  productId?: string; postalColumnType?: string;
} = {}): MondayPayload {
  if (!['paid', 'fulfilled'].includes(order.status) || !order.paidAt) throw new Error('order-not-paid');
  if (order.currency.toUpperCase() !== 'MXN') throw new Error('libro-board-requires-mxn');
  const productId = options.productId ?? LIBRO_PRODUCT_ID;
  const books = items.filter((item) => item.productId === productId);
  if (!books.length) throw new Error('order-has-no-libro');
  let quantity = 0;
  for (const item of books) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) throw new Error('invalid-libro-quantity');
    quantity += item.quantity;
  }
  const address = (order.shippingAddress ?? {}) as Record<string, unknown>;
  let street = text(address, 'line1');
  const columns: MondayPayload['columns'] = {
    forma_compra2: { index: 16 }, // ALAN.
    text7: order.customerEmail,
    due_date: { date: purchaseDate(order.paidAt) },
    numbers: fromMinorToDecimalString(productPaidMinor(order, items, productId)),
    // This board records the order's shipping charge, as does Agenda 2027.
    pago: fromMinorToDecimalString(toMinor(order.shippingAmount)),
    numbers9: quantity,
    texto: order.number,
    status3: null,
  };
  const postalCode = text(address, 'postalCode');
  if (postalCode) {
    if (options.postalColumnType === 'text') columns.dup__of_municipio_delegaci_n = postalCode;
    else street = [street, `CP: ${postalCode}`].filter(Boolean).join(' · ');
  }
  if (street) columns.calle = street;
  // Preserve the checkout address verbatim rather than guessing number/interior.
  if (text(address, 'line2')) columns.colonia = text(address, 'line2');
  if (text(address, 'city')) columns.municipio_delegaci_n7 = text(address, 'city');
  if (text(address, 'state')) columns.estado31 = text(address, 'state');
  const phone = order.customerPhone?.trim() || text(address, 'phone');
  if (phone) columns.phone = { phone, countryShortName: text(address, 'country').toUpperCase() || 'MX' };
  if (order.provider === 'paypal') columns.estado = { index: 7 };
  if (order.provider === 'mercadopago') columns.estado = { index: 8 };
  return {
    name: [order.customerFirstName, order.customerLastName].filter(Boolean).join(' ').trim() || order.customerEmail,
    orderNumber: order.number,
    columns,
  };
}
