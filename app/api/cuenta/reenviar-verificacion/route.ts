import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { rejectCrossSite } from '@/lib/request-guard';
import { ACCESS_COOKIE, NumeApiError, numeResendVerification } from '@/lib/nume-auth';

export const runtime = 'nodejs';

/** Proxy de `POST /auth/resend-verification` con la sesión del cliente. */
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;

  const accessToken = cookies().get(ACCESS_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ error: 'Inicia sesión de nuevo.' }, { status: 401 });
  }

  try {
    await numeResendVerification(accessToken);
    return NextResponse.json({
      ok: true,
      message: 'Si tu correo aún no está confirmado, te enviamos un enlace nuevo.',
    });
  } catch (error) {
    if (error instanceof NumeApiError) {
      if (error.status === 401) {
        return NextResponse.json({ error: 'Inicia sesión de nuevo.' }, { status: 401 });
      }
      if (error.status === 429) {
        return NextResponse.json(
          { error: 'Ya te enviamos varios enlaces. Espera un rato y revisa tu correo.' },
          { status: 429 },
        );
      }
    }
    console.error('[cuenta/reenviar-verificacion] error contra la API de nume:', error);
    return NextResponse.json(
      { error: 'No pudimos enviar el correo. Inténtalo más tarde.' },
      { status: 502 },
    );
  }
}
