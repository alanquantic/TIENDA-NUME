import { NextResponse } from 'next/server';
import { rejectCrossSite } from '@/lib/request-guard';
import { buildBrowserMirrorEvent, requestContext, type BrowserMirrorBody } from '@/lib/meta-capi';
import { isMetaCapiConfigured, sendMetaEvents } from '@/lib/meta-capi-send';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 16_000;

/**
 * Copia de los eventos del embudo (ViewContent, AddToCart, InitiateCheckout,
 * AddPaymentInfo) hacia la API de Conversiones de Meta, con el mismo eventID
 * que el Pixel. Llega aunque un bloqueador frene el script de Meta, porque es
 * una petición a la propia tienda. Solo con consentimiento de publicidad.
 */
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req, { requireJson: true });
  if (blocked) return blocked;
  if (!isMetaCapiConfigured()) return new NextResponse(null, { status: 204 });

  const ctx = requestContext(req);
  if (!ctx.adConsent) return new NextResponse(null, { status: 204 });

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Solicitud demasiado grande.' }, { status: 413 });
  }
  let body: BrowserMirrorBody;
  try {
    body = JSON.parse(raw) as BrowserMirrorBody;
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '';
  const event = buildBrowserMirrorEvent(body, ctx, { appHost: host });
  if (!event) return NextResponse.json({ error: 'Evento inválido.' }, { status: 400 });

  await sendMetaEvents([event]);
  return new NextResponse(null, { status: 204 });
}
