import { fromMinorToDecimalString, toMinor } from '../money';
import {
  initialProductJob, productPaidMinor, purchaseDate,
  type MondayOrder, type MondayItem, type MondayPayload,
  type MondayJobOptions, type MondayJob, type MondayColumns,
} from './shared';
import { AGENDA_2027_PRODUCT_ID } from '../order-limits';
export type { MondayJob, MondayColumns } from './shared';

// El ID vive en order-limits (lo usa también el carrito, del lado cliente).
export { AGENDA_2027_PRODUCT_ID };
export const AGENDA_2027_BOARD_ID = '18434858318';
export const AGENDA_2027_GROUP_ID = 'new_group';
export const MONDAY_JOB_KEY = 'mondayAgenda2027';

export type AgendaOrder = MondayOrder;
export type AgendaItem = MondayItem;
export type AgendaPayload = MondayPayload;

export function agendaItems(items: AgendaItem[], productId = AGENDA_2027_PRODUCT_ID) {
  return items.filter((item) => item.productId === productId);
}

export function initialAgendaJob(order: AgendaOrder, items: AgendaItem[], options: MondayJobOptions = {}): MondayJob | null {
  return initialProductJob(order, items, {
    productId: options.productId ?? AGENDA_2027_PRODUCT_ID,
    boardId: options.boardId ?? AGENDA_2027_BOARD_ID,
    groupId: options.groupId ?? AGENDA_2027_GROUP_ID,
    kind: 'agenda-2027', syncTestOrders: options.syncTestOrders,
  });
}

function text(record: Record<string, unknown>, key: string): string {
  return typeof record[key] === 'string' ? record[key].trim() : '';
}

/** Build exclusively from the paid order and immutable order-item snapshots. */
export function buildAgenda2027Payload(order: AgendaOrder, items: AgendaItem[], options: {
  productId?: string; postalColumnType?: string;
} = {}): AgendaPayload {
  if (!['paid', 'fulfilled'].includes(order.status) || !order.paidAt) throw new Error('order-not-paid');
  if (order.currency.toUpperCase() !== 'MXN') throw new Error('agenda-board-requires-mxn');
  const productId = options.productId ?? AGENDA_2027_PRODUCT_ID;
  const agendas = agendaItems(items, productId);
  if (!agendas.length) throw new Error('order-has-no-agenda-2027');
  let dark = 0;
  let light = 0;
  for (const item of agendas) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) throw new Error('invalid-agenda-quantity');
    const color = item.variantName?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    if (color === 'morada') dark += item.quantity;
    else if (color === 'amarilla') light += item.quantity;
    else throw new Error('unknown-agenda-color');
  }
  const address = (order.shippingAddress ?? {}) as Record<string, unknown>;
  const country = text(address, 'country').toUpperCase() || 'MX';
  const postalCode = text(address, 'postalCode');
  // Existing checkout captures street/number and neighborhood/interior together.
  // Keep them verbatim; do not invent a split from a free-text address.
  let street = text(address, 'line1');
  const columns: MondayColumns = {
    forma_compra2: { index: 16 },
    text7: order.customerEmail,
    due_date: { date: purchaseDate(order.paidAt) },
    numbers: fromMinorToDecimalString(productPaidMinor(order, items, productId)),
    pago: fromMinorToDecimalString(toMinor(order.shippingAmount)),
    numbers9: dark + light,
    numbers_2: dark,
    numbers_3: light,
    texto: order.number,
    // Explicitly empty; never mark a new purchase as shipped or delivered.
    status3: null,
  };
  if (postalCode) {
    if (options.postalColumnType === 'text') columns.dup__of_municipio_delegaci_n = postalCode;
    else street = [street, `CP: ${postalCode}`].filter(Boolean).join(' · ');
  }
  if (street) columns.calle = street;
  if (text(address, 'line2')) columns.colonia = text(address, 'line2');
  if (text(address, 'city')) columns.municipio_delegaci_n7 = text(address, 'city');
  if (text(address, 'state')) columns.estado31 = text(address, 'state');
  const phone = order.customerPhone?.trim() || text(address, 'phone');
  if (phone) columns.phone = { phone, countryShortName: country };
  if (order.provider === 'paypal') columns.estado = { index: 7 };
  // Mercado Pago offers several payment methods. Do not falsely label all as cards.
  return {
    name: [order.customerFirstName, order.customerLastName].filter(Boolean).join(' ').trim() || order.customerEmail,
    orderNumber: order.number,
    columns,
  };
}
