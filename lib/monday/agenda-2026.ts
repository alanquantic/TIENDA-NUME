import { fromMinorToDecimalString, toMinor } from '../money';
import {
  initialProductJob, productPaidMinor, purchaseDate,
  type MondayOrder, type MondayItem, type MondayPayload,
  type MondayJobOptions, type MondayJob, type MondayColumns,
} from './shared';
import { AGENDA_2026_PRODUCT_ID } from '../order-limits';
export type { MondayJob, MondayColumns } from './shared';

// Modelado a partir de agenda-2027.ts. Esta agenda no tiene variantes de
// color, por eso no se parten las cantidades en columnas separadas.
export { AGENDA_2026_PRODUCT_ID };
export const AGENDA_2026_BOARD_ID = '18396836595';
export const AGENDA_2026_GROUP_ID = 'new_group';
export const MONDAY_AGENDA_2026_JOB_KEY = 'mondayAgenda2026';

// Opciones del tablero (status columns) hard-coded a los valores pedidos para
// pedidos de la tienda web. Los indices corresponden al JSON de settings_str.
const VENDEDOR_ALAN_INDEX = 16;
const ENTREGA_ENVIO_INDEX = 3;
const FORMA_COMPRA_PAYPAL_INDEX = 7;

export type Agenda2026Order = MondayOrder;
export type Agenda2026Item = MondayItem;
export type Agenda2026Payload = MondayPayload;

export function agenda2026Items(items: Agenda2026Item[], productId = AGENDA_2026_PRODUCT_ID) {
  return items.filter((item) => item.productId === productId);
}

export function initialAgenda2026Job(
  order: Agenda2026Order,
  items: Agenda2026Item[],
  options: MondayJobOptions = {},
): MondayJob | null {
  return initialProductJob(order, items, {
    productId: options.productId ?? AGENDA_2026_PRODUCT_ID,
    boardId: options.boardId ?? AGENDA_2026_BOARD_ID,
    groupId: options.groupId ?? AGENDA_2026_GROUP_ID,
    kind: 'agenda-2026',
    syncTestOrders: options.syncTestOrders,
  });
}

function text(record: Record<string, unknown>, key: string): string {
  return typeof record[key] === 'string' ? record[key].trim() : '';
}

/** Payload para el tablero Agenda 2026 (board 18396836595). */
export function buildAgenda2026Payload(
  order: Agenda2026Order,
  items: Agenda2026Item[],
  options: { productId?: string; postalColumnType?: string } = {},
): Agenda2026Payload {
  if (!['paid', 'fulfilled'].includes(order.status) || !order.paidAt) throw new Error('order-not-paid');
  if (order.currency.toUpperCase() !== 'MXN') throw new Error('agenda-board-requires-mxn');
  const productId = options.productId ?? AGENDA_2026_PRODUCT_ID;
  const agendas = agenda2026Items(items, productId);
  if (!agendas.length) throw new Error('order-has-no-agenda-2026');
  let cantidad = 0;
  for (const item of agendas) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) throw new Error('invalid-agenda-quantity');
    cantidad += item.quantity;
  }
  const address = (order.shippingAddress ?? {}) as Record<string, unknown>;
  const country = text(address, 'country').toUpperCase() || 'MX';
  const postalCode = text(address, 'postalCode');
  const neighborhood = text(address, 'neighborhood');
  const exteriorNumber = text(address, 'exteriorNumber');
  let street = text(address, 'line1');
  const columns: MondayColumns = {
    forma_compra2: { index: VENDEDOR_ALAN_INDEX },
    forma_compra: { index: ENTREGA_ENVIO_INDEX },
    text7: order.customerEmail,
    due_date: { date: purchaseDate(order.paidAt) },
    numbers: fromMinorToDecimalString(productPaidMinor(order, items, productId)),
    pago: fromMinorToDecimalString(toMinor(order.shippingAmount)),
    numbers9: cantidad,
    texto: order.number,
    // Nunca marcar un pedido recien creado como enviado.
    status3: null,
  };
  if (postalCode) {
    if (options.postalColumnType === 'text') columns.dup__of_municipio_delegaci_n = postalCode;
    else street = [street, `CP: ${postalCode}`].filter(Boolean).join(' · ');
  }
  if (street) columns.calle = street;
  // Older orders stored neighborhood and interior together in line2.
  const colonia = neighborhood || (exteriorNumber ? '' : text(address, 'line2'));
  if (colonia) columns.colonia = colonia;
  const numbers = [
    exteriorNumber,
    (exteriorNumber || neighborhood) ? text(address, 'line2') : '',
  ].filter(Boolean).join(' · ');
  if (numbers) columns.n____n__int = numbers;
  if (text(address, 'crossStreets')) columns.dup__of_estado = text(address, 'crossStreets');
  if (text(address, 'city')) columns.municipio_delegaci_n7 = text(address, 'city');
  if (text(address, 'state')) columns.estado31 = text(address, 'state');
  const phone = order.customerPhone?.trim() || text(address, 'phone');
  if (phone) columns.phone = { phone, countryShortName: country };
  if (order.provider === 'paypal') columns.estado = { index: FORMA_COMPRA_PAYPAL_INDEX };
  return {
    name: [order.customerFirstName, order.customerLastName].filter(Boolean).join(' ').trim() || order.customerEmail,
    orderNumber: order.number,
    columns,
  };
}
