import { fromMinorToDecimalString } from '../money';
import {
  initialProductJob, productPaidMinor, purchaseDate,
  type MondayOrder, type MondayItem, type MondayPayload, type MondayJobOptions,
} from './shared';

export const COURSES_BOARD_ID = '8931163014';
export const COURSES_ORDER_COLUMN = 'texto';

// Catálogo y grupos verificados con las categorías de cursos y certificaciones.
export const MONDAY_COURSES = [
  { key: 'Complete', envKey: 'COMPLETE', productId: '72960467-738d-4100-933b-fe7dd18194c1',
    slug: 'certificacion-completa', groupId: 'new_group4207', groupTitle: 'CERTIFICACIÓN COMPLETA' },
  { key: 'Module1', envKey: 'MODULE_1', productId: 'b70fc68e-b966-4950-88e9-b7ef8b9db60f',
    slug: 'modulo-1', groupId: 'new_group78717', groupTitle: 'MODULO 1' },
  { key: 'Module2', envKey: 'MODULE_2', productId: '73b3629a-b252-40b0-bd88-aeeacc396f98',
    slug: 'modulo-2', groupId: 'grupo_nuevo14129', groupTitle: 'MODULO 2' },
  { key: 'Module3', envKey: 'MODULE_3', productId: '44a6f4f0-687d-4fba-bfe4-20ce5ec1fab9',
    slug: 'modulo-3', groupId: 'grupo_nuevo', groupTitle: 'MODULO 3' },
  { key: 'Module4', envKey: 'MODULE_4', productId: 'ff4f5ce3-de8a-42e3-985e-c667bd95a40b',
    slug: 'modulo-4', groupId: 'duplicate_of_modulo_5___1_y_2_', groupTitle: 'MODULO 4' },
  { key: 'Module5', envKey: 'MODULE_5', productId: '4126efa2-885a-4abf-8be8-fb87576eeefe',
    slug: 'modulo-5', groupId: 'duplicate_of_programa_online_n', groupTitle: 'MODULO 5' },
  { key: 'Module6', envKey: 'MODULE_6', productId: '01b8c7ce-3ea0-451a-b017-8a8166201461',
    slug: 'modulo-6', groupId: 'new_group', groupTitle: 'MODULO 6' },
  { key: 'NameWorkshop', envKey: 'NAME_WORKSHOP', productId: 'e11b3375-23ea-48d8-886c-4ea4fca05d4f',
    slug: 'taller-del-nombre', groupId: 'new_group67099', groupTitle: 'TALLER DEL NOMBRE' },
  { key: 'SpacesWorkshop', envKey: 'SPACES_WORKSHOP', productId: '9bc1c013-8f71-4aaf-a098-c6d115e5a300',
    slug: 'taller-casas-y-espacios', groupId: 'group_mkq0whct', groupTitle: 'TALLER CASAS Y ESPACIOS' },
  { key: 'CouplesWorkshop', envKey: 'COUPLES_WORKSHOP', productId: '1d636bee-b590-4fd9-a2de-34c3374877f0',
    slug: 'taller-pareja', groupId: 'group_mkq02f55', groupTitle: 'TALLER PAREJA PT 1' },
] as const;

export type MondayCourse = typeof MONDAY_COURSES[number];

export function courseProductId(course: MondayCourse) {
  return process.env[`MONDAY_COURSES_${course.envKey}_PRODUCT_ID`]?.trim() || course.productId;
}

export function courseGroupId(course: MondayCourse) {
  return process.env[`MONDAY_COURSES_${course.envKey}_GROUP_ID`]?.trim() || course.groupId;
}

function courseForProduct(productId: string) {
  return MONDAY_COURSES.find((course) =>
    course.productId === productId || courseProductId(course) === productId);
}

export function courseOrderReference(orderNumber: string, productId: string) {
  const course = courseForProduct(productId);
  if (!course) throw new Error('unknown-monday-course');
  return `${orderNumber}:${course.slug}`;
}

export function initialCourseJob(
  order: MondayOrder, items: MondayItem[], options: MondayJobOptions, course: MondayCourse,
) {
  return initialProductJob(order, items, {
    productId: courseProductId(course), boardId: options.boardId ?? COURSES_BOARD_ID,
    groupId: courseGroupId(course), kind: 'course', syncTestOrders: options.syncTestOrders,
  });
}

export function buildCoursePayload(
  order: MondayOrder, items: MondayItem[], options: { productId: string },
): MondayPayload {
  if (!['paid', 'fulfilled'].includes(order.status) || !order.paidAt) throw new Error('order-not-paid');
  if (order.currency.toUpperCase() !== 'MXN') throw new Error('courses-board-requires-mxn');
  const course = courseForProduct(options.productId);
  if (!course) throw new Error('unknown-monday-course');
  const lines = items.filter((item) => item.productId === options.productId);
  if (!lines.length) throw new Error('order-has-no-course');
  if (lines.some((item) => !Number.isSafeInteger(item.quantity) || item.quantity < 1)) {
    throw new Error('invalid-course-quantity');
  }
  const amount = fromMinorToDecimalString(productPaidMinor(order, items, options.productId));
  const reference = courseOrderReference(order.number, options.productId);
  const columns: MondayPayload['columns'] = {
    texto33: order.customerEmail,
    date_mkq01sah: { date: purchaseDate(order.paidAt) },
    numbers1: amount,
    n_meros: amount,
    [COURSES_ORDER_COLUMN]: reference,
  };
  // Sin adivinar cómo separar apellidos compuestos.
  if (order.customerLastName?.trim()) columns.texto0 = order.customerLastName.trim();
  const address = (order.shippingAddress ?? {}) as { country?: string; phone?: string };
  const phone = order.customerPhone?.trim() || address.phone?.trim();
  if (phone) columns.phone1 = { phone, countryShortName: address.country?.toUpperCase() || 'MX' };
  if (order.provider === 'paypal') columns.status2 = { index: 2 };
  if (order.provider === 'mercadopago') columns.status2 = { index: 10 };
  if (order.provider === 'stripe') columns.status2 = { index: 108 };
  const status = process.env.MONDAY_COURSES_STATUS_INDEX?.trim() ?? '1'; // INSCRITO, confirmado.
  if (status) {
    if (!/^(0|1|4|5|6|7|8|9|10|11|14|15|101|102)$/.test(status)) throw new Error('invalid-course-status');
    columns.status9 = { index: Number(status) };
  }
  if (order.customerBirthDate) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(order.customerBirthDate);
    if (!match) throw new Error('invalid-course-birth-date');
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    const check = new Date(0);
    check.setUTCFullYear(year, month - 1, day);
    if (year < 1 || check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) {
      throw new Error('invalid-course-birth-date');
    }
    columns.texto3 = day;
    columns.texto92 = { ids: [month] };
    columns.texto1 = year;
  }
  return { name: order.customerFirstName?.trim() || order.customerEmail, orderNumber: reference, columns };
}
