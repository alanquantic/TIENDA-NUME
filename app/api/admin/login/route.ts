import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, adminPassword, adminToken } from '@/lib/admin-auth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  const expected = adminPassword();

  if (!expected || !adminToken()) {
    return NextResponse.json(
      { error: 'Admin no configurado (falta ADMIN_PASSWORD / ADMIN_TOKEN).' },
      { status: 500 },
    );
  }
  if (body.password !== expected) {
    return NextResponse.json({ error: 'Contraseña incorrecta.' }, { status: 401 });
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
