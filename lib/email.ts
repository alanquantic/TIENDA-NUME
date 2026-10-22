import { Resend } from 'resend';
import { emailConfig } from './config';
import {
  renderOrderConfirmation,
  renderOrderFailed,
  renderOrderNotification,
  renderReportReady,
  renderTwoFactorEnabled,
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

type SendArgs = { to: string | string[]; subject: string; html: string; replyTo?: string };

/**
 * Envía un correo con Resend. Es best-effort: si falla o no hay API key,
 * registra en consola y NO lanza (nunca debe romper el fulfillment).
 */
async function sendEmail({ to, subject, html, replyTo = emailConfig.replyTo }: SendArgs): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.info(`[email] (sin RESEND_API_KEY) se habría enviado a ${to}: "${subject}"`);
    return;
  }
  try {
    const { error } = await resend.emails.send({
      from: emailConfig.from,
      to,
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    if (error) {
      console.error(`[email] Resend rechazó el envío a ${to}:`, error);
    }
  } catch (err) {
    console.error(`[email] Error enviando a ${to}:`, err);
  }
}

export async function sendOrderConfirmation(data: OrderEmailData): Promise<void> {
  const { subject, html } = renderOrderConfirmation(data);
  await sendEmail({ to: data.customerEmail, subject, html });
}

/** Aviso interno de compra pagada a ORDER_NOTIFY_EMAIL. Responder le escribe al cliente. */
export async function sendOrderNotification(data: OrderNotificationEmailData): Promise<void> {
  if (emailConfig.orderNotifyTo.length === 0) return;
  const { subject, html } = renderOrderNotification(data);
  await sendEmail({ to: emailConfig.orderNotifyTo, subject, html, replyTo: data.customerEmail });
}

/** Aviso al admin de que su verificación en dos pasos quedó activa. */
export async function sendTwoFactorEnabledNotice({ email }: { email: string }): Promise<void> {
  const { subject, html } = renderTwoFactorEnabled({ email, when: new Date() });
  await sendEmail({ to: email, subject, html });
}

export async function sendOrderFailed(
  data: Pick<
    OrderEmailData,
    'number' | 'customerName' | 'customerEmail' | 'currency' | 'items' | 'totalAmount'
  >,
): Promise<void> {
  const { subject, html } = renderOrderFailed(data);
  await sendEmail({ to: data.customerEmail, subject, html });
}

export async function sendReportReady(data: ReportReadyEmailData): Promise<void> {
  const { subject, html } = renderReportReady(data);
  await sendEmail({ to: data.customerEmail, subject, html });
}
