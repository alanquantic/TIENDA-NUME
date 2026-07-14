import { Resend } from 'resend';
import { emailConfig } from './config';
import {
  renderOrderConfirmation,
  renderOrderFailed,
  type OrderEmailData,
} from './email-templates';

let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (!emailConfig.resendApiKey) return null;
  if (!_resend) _resend = new Resend(emailConfig.resendApiKey);
  return _resend;
}

type SendArgs = { to: string; subject: string; html: string };

/**
 * Envía un correo con Resend. Es best-effort: si falla o no hay API key,
 * registra en consola y NO lanza (nunca debe romper el fulfillment).
 */
async function sendEmail({ to, subject, html }: SendArgs): Promise<void> {
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
      ...(emailConfig.replyTo ? { replyTo: emailConfig.replyTo } : {}),
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

export async function sendOrderFailed(
  data: Pick<
    OrderEmailData,
    'number' | 'customerName' | 'customerEmail' | 'currency' | 'items' | 'totalAmount'
  >,
): Promise<void> {
  const { subject, html } = renderOrderFailed(data);
  await sendEmail({ to: data.customerEmail, subject, html });
}
