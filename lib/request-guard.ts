import { NextResponse } from 'next/server';

/**
 * Defensa CSRF para los POST que dependen de cookies (login, logout, checkout).
 *
 * - `Origin`, si viene, debe ser el mismo host que atiende la petición: un
 *   formulario de otro sitio manda su propio origen y se rechaza.
 * - Con `requireJson`, el cuerpo debe declararse `application/json`: un
 *   formulario HTML no puede enviarlo sin preflight CORS, que la tienda no permite.
 *
 * Devuelve la respuesta 403 a regresar, o null si la petición es aceptable.
 */
export function rejectCrossSite(
  req: Request,
  { requireJson = false }: { requireJson?: boolean } = {},
): NextResponse | null {
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (origin) {
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null;
    }
    if (!originHost || originHost !== host) {
      return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 });
    }
  }

  if (requireJson) {
    const contentType = req.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().startsWith('application/json')) {
      return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 415 });
    }
  }

  return null;
}
