import { NextResponse, type NextRequest } from 'next/server';

const ADMIN_COOKIE = 'admin_session';

/**
 * Protege el panel admin. La cookie de sesión debe igualar ADMIN_TOKEN.
 * (Comparación simple de string — funciona en el runtime edge del middleware.)
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = process.env.ADMIN_TOKEN ?? '';
  const cookie = req.cookies.get(ADMIN_COOKIE)?.value;
  const authed = token.length > 0 && cookie === token;

  // El login siempre pasa.
  if (pathname === '/admin/login' || pathname === '/api/admin/login') {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/admin')) {
    if (!authed) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (pathname.startsWith('/admin')) {
    if (!authed) {
      const url = req.nextUrl.clone();
      url.pathname = '/admin/login';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
