import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, adminEmail, adminPassword, adminToken } from '@/lib/admin-auth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const expectedPassword = adminPassword();
  const expectedEmail = adminEmail();

  if (!expectedPassword || !adminToken()) {
    return NextResponse.json(
      { error: 'Admin no configurado (falta ADMIN_PASSWORD / ADMIN_TOKEN).' },
      { status: 500 },
    );
  }

  const emailOk =
    !expectedEmail ||
    (body.email ?? '').trim().toLowerCase() === expectedEmail.trim().toLowerCase();
  const passwordOk = body.password === expectedPassword;

  if (!emailOk || !passwordOk) {
    return NextResponse.json({ error: 'Correo o contraseña incorrectos.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, adminToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
