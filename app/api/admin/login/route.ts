import { NextResponse } from 'next/server';
import { isAdminUser } from '@/lib/admin-auth';
import {
  ACCESS_COOKIE,
  NumeApiError,
  numeLogin,
  numeLogout,
  REFRESH_COOKIE,
  sessionCookieOptions,
} from '@/lib/nume-auth';

export const runtime = 'nodejs';

/** Login del admin contra la API de nume; solo acepta cuentas con rol admin. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) {
    return NextResponse.json({ error: 'Escribe tu correo y tu contraseña.' }, { status: 400 });
  }

  try {
    const session = await numeLogin(email, password);
    if (!isAdminUser(session.user)) {
      await numeLogout(session.access_token);
      return NextResponse.json(
        { error: 'Esta cuenta no tiene permisos de administrador.' },
        { status: 403 },
      );
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set({ name: ACCESS_COOKIE, value: session.access_token, ...sessionCookieOptions });
    res.cookies.set({ name: REFRESH_COOKIE, value: session.refresh_token, ...sessionCookieOptions });
    return res;
  } catch (error) {
    if (error instanceof NumeApiError) {
      if (error.status === 401 || error.status === 400) {
        return NextResponse.json({ error: 'Correo o contraseña incorrectos.' }, { status: 401 });
      }
      if (error.status === 429) {
        return NextResponse.json(
          { error: 'Demasiados intentos. Espera un minuto y vuelve a intentarlo.' },
          { status: 429 },
        );
      }
    }
    console.error('[admin/login] error contra la API de nume:', error);
    return NextResponse.json(
      { error: 'No pudimos iniciar sesión en este momento. Inténtalo más tarde.' },
      { status: 502 },
    );
  }
}
