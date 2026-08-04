import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, numeLogout, REFRESH_COOKIE } from '@/lib/nume-auth';

export const runtime = 'nodejs';

/** Cierra la sesión: invalida el refresh token en la API y borra las cookies. */
export async function POST() {
  const accessToken = cookies().get(ACCESS_COOKIE)?.value;
  if (accessToken) {
    await numeLogout(accessToken);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: ACCESS_COOKIE, value: '', maxAge: 0, path: '/' });
  res.cookies.set({ name: REFRESH_COOKIE, value: '', maxAge: 0, path: '/' });
  return res;
}
