import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { Resend, type WebhookEventPayload } from 'resend';
import { emailConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { emailMessages } from '@/lib/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Estado final que deja cada evento (aperturas y clics no cambian el estado). */
const STATUS_BY_EVENT: Record<string, string> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.delivery_delayed': 'delivery_delayed',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
  'email.suppressed': 'suppressed',
};

/**
 * Avisos de Resend sobre los correos que manda la tienda: entrega, rebote,
 * aperturas y clics. Actualiza `email_messages` por el id de Resend.
 */
export async function POST(req: Request) {
  if (!emailConfig.webhookSecret) {
    return NextResponse.json({ error: 'Webhook de Resend sin configurar.' }, { status: 503 });
  }

  const rawBody = await req.text();
  let event: WebhookEventPayload;
  try {
    // verify() solo usa el secreto; la API key no se llama aquí.
    const resend = new Resend(emailConfig.resendApiKey || 're_webhook_only');
    event = resend.webhooks.verify({
      payload: rawBody,
      headers: {
        id: req.headers.get('svix-id') ?? '',
        timestamp: req.headers.get('svix-timestamp') ?? '',
        signature: req.headers.get('svix-signature') ?? '',
      },
      webhookSecret: emailConfig.webhookSecret,
    });
  } catch {
    return NextResponse.json({ error: 'Firma inválida.' }, { status: 401 });
  }

  if (!event.type.startsWith('email.') || !('email_id' in event.data)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const resendId = event.data.email_id;
  const at = new Date(event.created_at);
  const now = new Date();

  if (event.type === 'email.opened') {
    await db
      .update(emailMessages)
      .set({
        openCount: sql`${emailMessages.openCount} + 1`,
        openedAt: sql`coalesce(${emailMessages.openedAt}, ${at})`,
        updatedAt: now,
      })
      .where(eq(emailMessages.resendId, resendId));
  } else if (event.type === 'email.clicked') {
    await db
      .update(emailMessages)
      .set({
        clickCount: sql`${emailMessages.clickCount} + 1`,
        clickedAt: sql`coalesce(${emailMessages.clickedAt}, ${at})`,
        // Un clic implica que se abrió, aunque el pixel de apertura se bloquee.
        openedAt: sql`coalesce(${emailMessages.openedAt}, ${at})`,
        lastClickedUrl: event.data.click?.link ?? null,
        updatedAt: now,
      })
      .where(eq(emailMessages.resendId, resendId));
  } else if (STATUS_BY_EVENT[event.type]) {
    const status = STATUS_BY_EVENT[event.type];
    await db
      .update(emailMessages)
      .set({
        // 'sent' llega a veces después de 'delivered': no retrocede el estado.
        status: status === 'sent' ? sql`${emailMessages.status}` : status,
        ...(status === 'delivered' ? { deliveredAt: at } : {}),
        ...(event.type === 'email.bounced' ? { error: event.data.bounce?.message ?? 'Rebotado.' } : {}),
        updatedAt: now,
      })
      .where(eq(emailMessages.resendId, resendId));
  }

  return NextResponse.json({ ok: true });
}
