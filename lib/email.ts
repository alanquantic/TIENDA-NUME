import { Resend } from 'resend';
import { emailConfig } from './config';
import { db } from './db';
import { emailMessages } from './db/schema';
import {
  renderCartRecovery,
  renderOrderConfirmation,
  renderOrderFailed,
  renderOrderNotification,
  renderReportReady,
  renderTwoFactorEnabled,
  type CartRecoveryEmailData,
  type OrderEmailData,
  type OrderNotificationEmailData,
  type ReportReadyEmailData,
} from './email-templates';

let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (!emailConfig.resendApiKey) return null;
  if (!_resend) _resend = new Resend(emailConfig.resendApiKey);
  return _resend;
}

export type EmailKind =
  | 'order_confirmation'
  | 'order_notification'
  | 'order_failed'
  | 'report_ready'
  | 'cart_recovery'
  | 'admin_2fa';

type SendArgs = {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  /** Para el registro de envíos del admin (estado, aperturas y clics). */
  kind: EmailKind;
  orderId?: string | null;
};

/** Guarda el envío para seguirlo con el webhook de Resend. Nunca lanza. */
async function logEmail(args: SendArgs, resendId: string | null, error: string | null): Promise<void> {
  try {
    await db.insert(emailMessages).values({
      resendId,
      kind: args.kind,
      orderId: args.orderId ?? null,
      toEmail: Array.isArray(args.to) ? args.to.join(', ') : args.to,
      subject: args.subject,
      status: error ? 'failed' : 'sent',
      error,
    });
  } catch (err) {
    console.error('[email] no se pudo registrar el envío', err);
  }
}

/**
 * Envía un correo con Resend. Es best-effort: si falla o no hay API key,
 * registra en consola y NO lanza (nunca debe romper el fulfillment).
 */
async function sendEmail(args: SendArgs): Promise<void> {
  const { to, subject, html, replyTo = emailConfig.replyTo } = args;
  const resend = getResend();
  if (!resend) {
    console.info(`[email] (sin RESEND_API_KEY) se habría enviado a ${to}: "${subject}"`);
    return;
  }
  try {
    const { data, error } = await resend.emails.send({
      from: emailConfig.from,
      to,
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    if (error) {
      console.error(`[email] Resend rechazó el envío a ${to}:`, error);
    }
    await logEmail(args, data?.id ?? null, error ? (error.message ?? 'Resend rechazó el envío.') : null);
  } catch (err) {
    console.error(`[email] Error enviando a ${to}:`, err);
    await logEmail(args, null, err instanceof Error ? err.message : 'Error enviando el correo.');
  }
}

export async function sendOrderConfirmation(data: OrderEmailData, orderId?: string): Promise<void> {
  const { subject, html } = renderOrderConfirmation(data);
  await sendEmail({ to: data.customerEmail, subject, html, kind: 'order_confirmation', orderId });
}

/** Aviso interno de compra pagada a ORDER_NOTIFY_EMAIL. Responder le escribe al cliente. */
export async function sendOrderNotification(
  data: OrderNotificationEmailData,
  orderId?: string,
): Promise<void> {
  if (emailConfig.orderNotifyTo.length === 0) return;
  const { subject, html } = renderOrderNotification(data);
  await sendEmail({
    to: emailConfig.orderNotifyTo,
    subject,
    html,
    replyTo: data.customerEmail,
    kind: 'order_notification',
    orderId,
  });
}

/** Aviso al admin de que su verificación en dos pasos quedó activa. */
export async function sendTwoFactorEnabledNotice({ email }: { email: string }): Promise<void> {
  const { subject, html } = renderTwoFactorEnabled({ email, when: new Date() });
  await sendEmail({ to: email, subject, html, kind: 'admin_2fa' });
}

export async function sendOrderFailed(
  data: Pick<
    OrderEmailData,
    'number' | 'customerName' | 'customerEmail' | 'currency' | 'items' | 'totalAmount'
  > & { recoveryUrl?: string | null },
  orderId?: string,
): Promise<void> {
  const { subject, html } = renderOrderFailed(data);
  await sendEmail({ to: data.customerEmail, subject, html, kind: 'order_failed', orderId });
}

export async function sendReportReady(data: ReportReadyEmailData, orderId?: string): Promise<void> {
  const { subject, html } = renderReportReady(data);
  await sendEmail({ to: data.customerEmail, subject, html, kind: 'report_ready', orderId });
}

export async function sendCartRecovery(data: CartRecoveryEmailData & { to: string }): Promise<void> {
  const { subject, html } = renderCartRecovery(data);
  await sendEmail({ to: data.to, subject, html, kind: 'cart_recovery' });
}
