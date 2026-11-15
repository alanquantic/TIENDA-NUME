import 'server-only';
import type { MetaServerEvent } from './meta-capi';

// Envío a la API de Conversiones. Sin token configurado no hace nada, así la
// tienda funciona igual en local o si se quita la variable.
//
// Variables (Vercel):
//   META_CAPI_ACCESS_TOKEN     token del conjunto de datos (Administrador de eventos →
//                              Configuración → API de conversiones → Generar token)
//   NEXT_PUBLIC_META_PIXEL_ID  el mismo Pixel del navegador
//   META_CAPI_TEST_EVENT_CODE  opcional: código de "Probar eventos" para verlos en vivo

const GRAPH_VERSION = 'v21.0';
const TIMEOUT_MS = 4000;

export function isMetaCapiConfigured(): boolean {
  return Boolean(process.env.META_CAPI_ACCESS_TOKEN && process.env.NEXT_PUBLIC_META_PIXEL_ID);
}

export async function sendMetaEvents(events: MetaServerEvent[]): Promise<boolean> {
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  if (!token || !pixelId || events.length === 0) return false;

  const body: Record<string, unknown> = { data: events };
  const testCode = process.env.META_CAPI_TEST_EVENT_CODE?.trim();
  if (testCode) body.test_event_code = testCode;

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: 'no-store',
      },
    );
    if (!res.ok) {
      // Nunca se registra el token ni los datos del cliente: solo el error de Meta.
      const detail = await res.text().catch(() => '');
      console.error('[meta-capi] Meta rechazó el envío', res.status, detail.slice(0, 500));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[meta-capi] no se pudo enviar', events.map((e) => e.event_name).join(','), err);
    return false;
  }
}
