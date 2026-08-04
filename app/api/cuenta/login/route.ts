import { NextResponse } from 'next/server';
import {
  ACCESS_COOKIE,
  NumeApiError,
  numeLogin,
  REFRESH_COOKIE,
  sessionCookieOptions,
} from '@/lib/nume-auth';

export const runtime = 'nodejs';

/** Proxy del login a la API de nume; guarda los JWT en cookies httpOnly. */
export async function POST(req: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) {
    return NextResponse.json({ error: 'Escribe tu correo y tu contraseña.' }, { status: 400 });
  }

  try {
    const session = await numeLogin(email, password);
    const res = NextResponse.json({ ok: true, email: session.user.email });
    res.cookies.set({ name: ACCESS_COOKIE, value: session.access_token, ...sessionCookieOptions });
    res.cookies.set({ name: REFRESH_COOKIE, value: session.refresh_token, ...sessionCookieOptions });
    return res;
  } catch (error) {
    if (error instanceof NumeApiError) {
      if (error.status === 401 || error.status === 400) {
        return NextResponse.json(
          { error: 'Correo o contraseña incorrectos.' },
          { status: 401 },
        );
      }
      if (error.status === 429) {
        return NextResponse.json(
          { error: 'Demasiados intentos. Espera un minuto y vuelve a intentarlo.' },
          { status: 429 },
        );
      }
    }
    console.error('[cuenta/login] error contra la API de nume:', error);
    return NextResponse.json(
      { error: 'No pudimos iniciar sesión en este momento. Inténtalo más tarde.' },
      { status: 502 },
    );
  }
}
