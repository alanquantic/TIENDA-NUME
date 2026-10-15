import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/nume-session';

export const dynamic = 'force-dynamic';

/** Middleware renews expired credentials before this route reads the session. */
export async function GET() {
  try {
    const user = await getSessionUser();
    return NextResponse.json({ authenticated: Boolean(user) }, {
      status: user ? 200 : 401,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'Sesión temporalmente no disponible.' }, { status: 503 });
  }
}
