import { config } from './config';
import { formatDecimal } from './money';

// Paleta de marca (nume) en HEX para correo (los clientes no leen variables CSS).
const BRAND = {
  purple: '#4B1D95',
  fuchsia: '#A816B6',
  text: '#2b2340',
  muted: '#6b6480',
  bg: '#f6f3fb',
  card: '#ffffff',
  border: '#e7e1f2',
  soft: '#f3eefb',
  green: '#15803d',
  red: '#b91c1c',
};

export type EmailAddress = {
  name?: string;
  line1?: string;
  line2?: string | null;
  city?: string;
  state?: string | null;
  postalCode?: string;
  country?: string;
  phone?: string | null;
};

export type OrderEmailItem = {
  name: string;
  variantName: string | null;
  quantity: number;
  totalAmount: string;
  type: 'digital' | 'physical';
};

export type OrderEmailData = {
  number: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  currency: string;
  items: OrderEmailItem[];
  subtotalAmount: string;
  discountAmount: string;
  discountCode: string | null;
  shippingAmount: string;
  taxAmount: string;
  totalAmount: string;
  requiresShipping: boolean;
  shippingMethod: string | null;
  shippingAddress: EmailAddress | null;
  downloads: { name: string; url: string }[];
  reports?: { name: string; url: string }[];
};

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(value: string, currency: string): string {
  return formatDecimal(value, currency);
}

/** Envoltura común: cabecera de marca + contenido + pie. */
function layout(opts: { preheader: string; heading: string; accent: string; body: string }): string {
  const store = esc(config.storeName);
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;font-family:Roboto,Arial,Helvetica,sans-serif;">
      <tr>
        <td style="background:${BRAND.purple};background-image:linear-gradient(120deg,${BRAND.purple},${BRAND.fuchsia});padding:22px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:.3px;">
              ${store}
            </td>
            <td align="right" style="color:rgba(255,255,255,.8);font-size:12px;">Numerología Cotidiana</td>
          </tr></table>
        </td>
      </tr>
      <tr><td style="padding:32px 28px 8px;">
        <h1 style="margin:0 0 6px;font-size:22px;line-height:1.25;color:${opts.accent};font-family:Roboto,Arial,sans-serif;">${esc(opts.heading)}</h1>
      </td></tr>
      <tr><td style="padding:0 28px 28px;color:${BRAND.text};font-size:14px;line-height:1.6;">
        ${opts.body}
      </td></tr>
      <tr>
        <td style="padding:20px 28px;background:${BRAND.soft};border-top:1px solid ${BRAND.border};color:${BRAND.muted};font-size:12px;line-height:1.6;font-family:Roboto,Arial,sans-serif;">
          ${store} · ¿Dudas? Responde a este correo y te ayudamos.<br>
          <a href="${config.appUrl}" style="color:${BRAND.purple};text-decoration:none;">${esc(config.appUrl.replace(/^https?:\/\//, ''))}</a>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function itemsTable(data: OrderEmailData): string {
  const rows = data.items
    .map(
      (i) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};font-size:14px;color:${BRAND.text};">
          ${esc(i.name)}${i.variantName ? ` <span style="color:${BRAND.muted};">— ${esc(i.variantName)}</span>` : ''}
          <span style="color:${BRAND.muted};font-size:12px;"> × ${i.quantity}</span>
          <span style="display:inline-block;margin-left:6px;padding:1px 6px;border-radius:6px;background:${BRAND.soft};color:${BRAND.purple};font-size:10px;text-transform:uppercase;letter-spacing:.4px;">${i.type === 'digital' ? 'Digital' : 'Físico'}</span>
        </td>
        <td align="right" style="padding:10px 0;border-bottom:1px solid ${BRAND.border};font-size:14px;color:${BRAND.text};white-space:nowrap;">${money(i.totalAmount, data.currency)}</td>
      </tr>`,
    )
    .join('');

  const totalRow = (label: string, value: string, bold = false, color = BRAND.text) =>
    `<tr>
      <td style="padding:4px 0;font-size:${bold ? '15px' : '13px'};color:${color};${bold ? 'font-weight:700;' : ''}">${label}</td>
      <td align="right" style="padding:4px 0;font-size:${bold ? '15px' : '13px'};color:${color};${bold ? 'font-weight:700;' : ''}white-space:nowrap;">${value}</td>
    </tr>`;

  const totals = [
    totalRow('Subtotal', money(data.subtotalAmount, data.currency)),
    parseFloat(data.discountAmount) > 0
      ? totalRow(
          `Descuento${data.discountCode ? ` (${esc(data.discountCode)})` : ''}`,
          `- ${money(data.discountAmount, data.currency)}`,
          false,
          BRAND.green,
        )
      : '',
    data.requiresShipping
      ? totalRow(
          `Envío${data.shippingMethod ? ` (${esc(data.shippingMethod)})` : ''}`,
          parseFloat(data.shippingAmount) > 0 ? money(data.shippingAmount, data.currency) : 'Gratis',
        )
      : '',
    parseFloat(data.taxAmount) > 0 ? totalRow('Impuestos', money(data.taxAmount, data.currency)) : '',
    totalRow('Total', money(data.totalAmount, data.currency), true, BRAND.purple),
  ]
    .filter(Boolean)
    .join('');

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0 4px;">
      ${rows}
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;">
      ${totals}
    </table>`;
}

function customerBlock(data: OrderEmailData): string {
  const lines = [
    `<strong>${esc(data.customerName || '—')}</strong>`,
    esc(data.customerEmail),
    data.customerPhone ? esc(data.customerPhone) : '',
  ]
    .filter(Boolean)
    .join('<br>');
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">
      <tr><td style="font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:${BRAND.muted};padding-bottom:6px;">Cliente</td></tr>
      <tr><td style="font-size:14px;color:${BRAND.text};line-height:1.6;">${lines}</td></tr>
    </table>`;
}

function addressBlock(addr: EmailAddress | null): string {
  if (!addr) return '';
  const parts = [
    esc(addr.name ?? ''),
    esc(addr.line1 ?? '') + (addr.line2 ? `, ${esc(addr.line2)}` : ''),
    `${esc(addr.city ?? '')}${addr.state ? `, ${esc(addr.state)}` : ''} ${esc(addr.postalCode ?? '')}`.trim(),
    esc(addr.country ?? ''),
  ]
    .filter((p) => p && p.trim())
    .join('<br>');
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 4px;">
      <tr><td style="font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:${BRAND.muted};padding-bottom:6px;">Envío</td></tr>
      <tr><td style="font-size:14px;color:${BRAND.text};line-height:1.6;">${parts}</td></tr>
    </table>`;
}

function downloadsBlock(data: OrderEmailData): string {
  if (data.downloads.length === 0) return '';
  const buttons = data.downloads
    .map(
      (d) => `
      <tr><td style="padding:4px 0;">
        <a href="${d.url}" style="display:inline-block;background:${BRAND.purple};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:10px;">⬇ ${esc(d.name)}</a>
      </td></tr>`,
    )
    .join('');
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 4px;">
      <tr><td style="font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:${BRAND.muted};padding-bottom:8px;">Tus descargas</td></tr>
      ${buttons}
    </table>`;
}

function reportsBlock(data: OrderEmailData): string {
  const reports = data.reports ?? [];
  if (reports.length === 0) return '';
  const buttons = reports
    .map(
      (r) => `
      <tr><td style="padding:4px 0;">
        <a href="${r.url}" style="display:inline-block;background:${BRAND.fuchsia};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:10px;">📄 ${esc(r.name)}</a>
      </td></tr>`,
    )
    .join('');
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 4px;">
      <tr><td style="font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:${BRAND.muted};padding-bottom:8px;">Tus reportes</td></tr>
      ${buttons}
    </table>`;
}

export function renderOrderConfirmation(data: OrderEmailData): { subject: string; html: string } {
  const body = `
    <p style="margin:0 0 14px;">Recibimos tu pago correctamente. Aquí está el resumen de tu pedido <strong style="color:${BRAND.purple};">${esc(data.number)}</strong>.</p>
    ${customerBlock(data)}
    <div style="height:1px;background:${BRAND.border};margin:18px 0;"></div>
    ${itemsTable(data)}
    ${addressBlock(data.shippingAddress)}
    ${reportsBlock(data)}
    ${downloadsBlock(data)}
    ${data.requiresShipping ? `<p style="margin:18px 0 0;color:${BRAND.muted};font-size:13px;">Te avisaremos cuando tu pedido físico sea enviado.</p>` : ''}
  `;
  return {
    subject: `Confirmación de tu pedido ${data.number}`,
    html: layout({
      preheader: `Gracias por tu compra — pedido ${data.number}`,
      heading: '¡Gracias por tu compra!',
      accent: BRAND.purple,
      body,
    }),
  };
}

export function renderOrderFailed(
  data: Pick<OrderEmailData, 'number' | 'customerName' | 'currency' | 'items' | 'totalAmount'>,
): { subject: string; html: string } {
  const list = data.items
    .map((i) => `<li style="margin-bottom:4px;">${esc(i.name)} <span style="color:${BRAND.muted};">× ${i.quantity}</span></li>`)
    .join('');
  const body = `
    <p style="margin:0 0 14px;">Hola ${esc(data.customerName || '')}, no pudimos completar el pago de tu pedido <strong>${esc(data.number)}</strong>, así que <strong>no se realizó ningún cargo</strong>.</p>
    ${list ? `<p style="margin:0 0 6px;color:${BRAND.muted};font-size:13px;">Tu carrito:</p><ul style="margin:0 0 14px;padding-left:18px;color:${BRAND.text};font-size:14px;">${list}</ul>` : ''}
    <p style="margin:0 0 18px;">Puedes intentar de nuevo cuando quieras. Tus productos siguen disponibles.</p>
    <a href="${config.appUrl}" style="display:inline-block;background:${BRAND.purple};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 20px;border-radius:10px;">Volver a la tienda</a>
    <p style="margin:18px 0 0;color:${BRAND.muted};font-size:13px;">Si crees que fue un error o necesitas ayuda, responde a este correo.</p>
  `;
  return {
    subject: `No pudimos completar tu pedido ${data.number}`,
    html: layout({
      preheader: `Tu compra no se completó — no se hizo ningún cargo`,
      heading: 'Tu compra no se completó',
      accent: BRAND.red,
      body,
    }),
  };
}
