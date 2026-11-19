import { fromMinorToDecimalString } from '../money';
import {
  initialProductJob, productPaidMinor, purchaseDate,
  type MondayOrder, type MondayItem, type MondayPayload, type MondayJobOptions,
} from './shared';

export const REPORTS_BOARD_ID = '8931198393';
export const REPORTS_ORDER_COLUMN = 'texto';

// Productos de reportes-numerologicos con grupo verificado en este tablero.
export const MONDAY_REPORTS = [
  { key: 'WhoAmI', envKey: 'WHO_AM_I', productId: 'd2454c59-91fd-4088-94fc-8849af3590a0',
    slug: 'quien-soy', reportKey: 'quien-soy', groupId: 'new_group4207', groupTitle: 'QUIEN SOY' },
  { key: 'WhoAmILegacy', envKey: 'WHO_AM_I_LEGACY', productId: 'b624f1a7-d95c-4c09-99f6-efead9fada20',
    slug: 'reporte-quien-soy', reportKey: 'reporte-quien-soy', groupId: 'new_group4207', groupTitle: 'QUIEN SOY' },
  { key: 'WhoAmIExtended', envKey: 'WHO_AM_I_EXTENDED', productId: '5e68db7d-fd1d-4eb7-9d75-0fac88f2d276',
    slug: 'quien-soy-extendido', reportKey: 'reporte-quien-soy-extended', groupId: 'new_group78717', groupTitle: 'QUIEN SOY VERSION EXTENDIDA' },
  { key: 'CoupleAntidote', envKey: 'COUPLE_ANTIDOTE', productId: '5ca77f21-e538-4906-97c1-d24e27a5c2e5',
    slug: 'antidoto-pareja', reportKey: 'reporte-antidoto', groupId: 'grupo_nuevo14129', groupTitle: 'ANTIDOTO PAREJA' },
  { key: 'CouplePersonality', envKey: 'COUPLE_PERSONALITY', productId: 'c375dff2-03eb-44c8-8a6c-295e32f92b97',
    slug: 'personalidad-pareja', reportKey: 'reporte-personalidad-pareja', groupId: 'grupo_nuevo', groupTitle: 'PERSONALIDAD PAREJA' },
  { key: 'CoupleYear', envKey: 'COUPLE_YEAR', productId: '7b0d2390-a711-4c5b-90e2-1a34b5324bb6',
    slug: 'ano-personal-pareja', reportKey: 'nuestra-leccion', groupId: 'duplicate_of_modulo_5___1_y_2_', groupTitle: 'AÑO PERSONAL DE PAREJA' },
  { key: 'LifeStage', envKey: 'LIFE_STAGE', productId: 'c13ac828-2a7b-459f-aa3e-a5e9ad7679d3',
    slug: 'etapa-de-vida', reportKey: 'reporte-etapa-de-vida-2026', groupId: 'duplicate_of_programa_online_n', groupTitle: 'ETAPA DE VIDA' },
  { key: 'LovePersonalYear', envKey: 'LOVE_PERSONAL_YEAR', productId: '3f26c4b6-0f08-4a9c-92dd-a9aac0afcfbd',
    slug: 'amor-ano-personal', reportKey: 'amor-pareja-ano-personal', groupId: 'new_group', groupTitle: 'EL AMOR SEGUN AÑO PERSONAL' },
  { key: 'Teacher', envKey: 'TEACHER', productId: '3088138d-2a92-427f-912c-9c4cd4c1476f',
    slug: 'quien-es-mi-maestro', reportKey: 'reporte-maestro', groupId: 'new_group67099', groupTitle: 'QUIEN ES MI MAESTRO' },
  { key: 'CoupleWound', envKey: 'COUPLE_WOUND', productId: '27b3c1b5-3a56-46ad-a129-a2ddc30fe0da',
    slug: 'herida-pareja', reportKey: 'reporte-herida', groupId: 'group_mkq0whct', groupTitle: 'LA HERIDA DE PAREJA' },
  { key: 'CoupleNumerology', envKey: 'COUPLE_NUMEROLOGY', productId: '99b68823-0426-4712-940c-37421d665c8b',
    slug: 'numerologia-pareja', reportKey: 'reporte-pareja', groupId: 'group_mkq02f55', groupTitle: 'NUMEROLOGIA DE PAREJA' },
] as const;

export type MondayReport = typeof MONDAY_REPORTS[number];

export function reportProductId(report: MondayReport) {
  return process.env[`MONDAY_REPORTS_${report.envKey}_PRODUCT_ID`]?.trim() || report.productId;
}

export function reportGroupId(report: MondayReport) {
  return process.env[`MONDAY_REPORTS_${report.envKey}_GROUP_ID`]?.trim() || report.groupId;
}

function reportForProduct(productId: string) {
  return MONDAY_REPORTS.find((report) => report.productId === productId || reportProductId(report) === productId);
}

export function reportOrderReference(orderNumber: string, productId: string) {
  const report = reportForProduct(productId);
  if (!report) throw new Error('unknown-monday-report');
  return `${orderNumber}:${report.slug}`;
}

export function initialReportJob(
  order: MondayOrder, items: MondayItem[], options: MondayJobOptions, report: MondayReport,
) {
  return initialProductJob(order, items, {
    productId: reportProductId(report), boardId: options.boardId ?? REPORTS_BOARD_ID,
    groupId: reportGroupId(report), kind: 'report', syncTestOrders: options.syncTestOrders,
  });
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function person(value: unknown) {
  const data = record(value);
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const birthDate = typeof data.birthDate === 'string' ? data.birthDate.trim() : '';
  return name || birthDate ? { name, birthDate } : null;
}

function reportInput(lines: MondayItem[], report: MondayReport) {
  const inputs = lines.flatMap((line) => {
    const metadata = record(line.metadata);
    const reports = Array.isArray(metadata.reports) ? metadata.reports : metadata.report ? [metadata.report] : [];
    return reports.filter((value) => record(value).key === report.reportKey).map((value) => ({
      person: person(record(value).person), partner: person(record(value).partner),
    }));
  });
  if (new Set(inputs.map((input) => JSON.stringify(input))).size > 1) {
    throw new Error('multiple-report-recipients-needs-review');
  }
  return inputs[0];
}

function birthColumns(value: string, dayKey: string, monthKey: string, yearKey: string): MondayPayload['columns'] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error('invalid-monday-report-birth-date');
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const check = new Date(0);
  check.setUTCFullYear(year, month - 1, day);
  if (year < 1 || check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) {
    throw new Error('invalid-monday-report-birth-date');
  }
  return { [dayKey]: day, [monthKey]: { ids: [month] }, [yearKey]: year };
}

export function buildReportPayload(
  order: MondayOrder, items: MondayItem[], options: { productId: string },
): MondayPayload {
  if (!['paid', 'fulfilled'].includes(order.status) || !order.paidAt) throw new Error('order-not-paid');
  if (order.currency.toUpperCase() !== 'MXN') throw new Error('reports-board-requires-mxn');
  const report = reportForProduct(options.productId);
  if (!report) throw new Error('unknown-monday-report');
  const lines = items.filter((item) => item.productId === options.productId);
  if (!lines.length) throw new Error('order-has-no-report');
  if (lines.some((item) => !Number.isSafeInteger(item.quantity) || item.quantity < 1)) {
    throw new Error('invalid-report-quantity');
  }
  const input = reportInput(lines, report);
  const amount = fromMinorToDecimalString(productPaidMinor(order, items, options.productId));
  const reference = reportOrderReference(order.number, options.productId);
  const columns: MondayPayload['columns'] = {
    texto33: order.customerEmail,
    date_mkq01sah: { date: purchaseDate(order.paidAt) },
    numbers1: amount, n_meros: amount,
    [REPORTS_ORDER_COLUMN]: reference,
  };
  // Los datos del reporte pueden ser de un regalo. El contacto sigue siendo el comprador.
  const name = input?.person?.name || order.customerFirstName?.trim() || order.customerEmail;
  if (!input?.person && order.customerLastName?.trim()) columns.texto0 = order.customerLastName.trim();
  const birthDate = input?.person ? input.person.birthDate : order.customerBirthDate;
  if (birthDate) Object.assign(columns, birthColumns(birthDate, 'texto3', 'texto92', 'texto1'));
  if (input?.partner?.name) columns.text_mkq0px85 = input.partner.name;
  if (input?.partner?.birthDate) {
    Object.assign(columns, birthColumns(input.partner.birthDate, 'numeric_mkq0faq4', 'dropdown_mkq061qa', 'numeric_mkq0a358'));
  }
  const address = (order.shippingAddress ?? {}) as { country?: string; phone?: string };
  const phone = order.customerPhone?.trim() || address.phone?.trim();
  if (phone) columns.phone1 = { phone, countryShortName: address.country?.toUpperCase() || 'MX' };
  if (order.provider === 'paypal') columns.status2 = { index: 2 };
  if (order.provider === 'stripe') columns.status2 = { index: 108 };
  const mpIndex = process.env.MONDAY_REPORTS_MERCADOPAGO_INDEX?.trim();
  if (order.provider === 'mercadopago' && mpIndex) {
    if (!/^\d+$/.test(mpIndex) || !Number.isSafeInteger(Number(mpIndex))) throw new Error('invalid-report-payment-index');
    columns.status2 = { index: Number(mpIndex) };
  }
  const status = process.env.MONDAY_REPORTS_STATUS_INDEX?.trim() ?? '1'; // INSCRITO, confirmado.
  if (status) {
    if (!/^(0|1|4|5|6|7|8|9|10|11|14|15|101|102)$/.test(status)) throw new Error('invalid-report-status');
    columns.status9 = { index: Number(status) };
  }
  return { name, orderNumber: reference, columns };
}
