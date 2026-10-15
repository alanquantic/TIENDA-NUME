import { NextResponse, type NextRequest } from 'next/server';
import {
  ACCESS_COOKIE,
  clientIpFrom,
  NUME_API_BASE_URL,
  proxyHeaders,
  REFRESH_COOKIE,
  createAccessCookie,
  createRefreshCookie,
  tokenMaxAge,
} from '@/lib/nume-auth';

type AuthSessionResponse = {
  access_token: string;
  refresh_token: string;
};

type MeResponse = { role?: string };

function redirectToAccountLogin(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = '/cuenta/login';
  url.search = '';
  url.searchParams.set('next', req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

function clearSessionCookies(res: NextResponse) {
  res.cookies.set({ name: ACCESS_COOKIE, value: '', maxAge: 0, path: '/' });
  res.cookies.set({ name: REFRESH_COOKIE, value: '', maxAge: 0, path: '/' });
}

async function fetchMe(accessToken: string) {
  return fetch(`${NUME_API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
}

/** Renew sessions before rendering, including public pages and API requests. */
async function handleSession(req: NextRequest, mode: 'optional' | 'account' | 'admin') {
  const isApi = req.nextUrl.pathname.startsWith('/api/');
  const deny = (clear = false) => {
    const res = mode === 'optional'
      ? NextResponse.next()
      : isApi
        ? NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
        : mode === 'admin'
          ? NextResponse.redirect(new URL('/admin/login', req.url))
          : redirectToAccountLogin(req);
    if (clear) clearSessionCookies(res);
    return res;
  };
  const unavailable = () => mode === 'optional'
    ? NextResponse.next()
    : NextResponse.json({ error: 'No se pudo validar la sesión. Inténtalo de nuevo.' }, { status: 503 });
  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!accessToken && !refreshToken) return deny();
  if (mode === 'optional' && accessToken && tokenMaxAge(accessToken) > 60) return NextResponse.next();

  try {
    let meResponse = accessToken ? await fetchMe(accessToken) : null;
    if (meResponse && !meResponse.ok && meResponse.status !== 401) return unavailable();
    let refreshed: AuthSessionResponse | null = null;
    if (!meResponse || meResponse.status === 401) {
      if (!refreshToken) return deny();
      const refreshResponse = await fetch(`${NUME_API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...proxyHeaders(clientIpFrom(req.headers, req.ip)),
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
        cache: 'no-store',
      });
      if (!refreshResponse.ok) return refreshResponse.status === 401 ? deny(true) : unavailable();
      refreshed = (await refreshResponse.json()) as AuthSessionResponse;
      meResponse = await fetchMe(refreshed.access_token);
    }
    if (!meResponse.ok) return meResponse.status === 401 ? deny(true) : unavailable();
    const me = (await meResponse.json()) as MeResponse;
    // Authentication alone never grants access to the admin panel.
    if (mode === 'admin' && me.role !== 'admin') return deny();
    if (!refreshed) return NextResponse.next();
    req.cookies.set(ACCESS_COOKIE, refreshed.access_token);
    req.cookies.set(REFRESH_COOKIE, refreshed.refresh_token);
    const res = NextResponse.next({ request: { headers: req.headers } });
    res.cookies.set(createAccessCookie(refreshed.access_token));
    res.cookies.set(createRefreshCookie(refreshed.refresh_token));
    return res;
  } catch {
    // An unavailable API must not log the customer out or erase their cookies.
    return unavailable();
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Cuenta del cliente (sesión de nume) ──────────────────────
  if (pathname.startsWith('/cuenta') && pathname !== '/cuenta/login') {
    return handleSession(req, 'account');
  }

  // ── Retorno de pasarelas: quitar el query string ─────────────
  // Mercado Pago y PayPal agregan ids de pago/pedido a la URL de retorno. La
  // página no los usa (identifica el pedido por cookie) y así no quedan en el
  // historial del navegador ni llegan a la analítica.
  if ((pathname === '/checkout/success' || pathname === '/checkout/cancel') && req.nextUrl.search) {
    const url = req.nextUrl.clone();
    url.search = '';
    return NextResponse.redirect(url);
  }

  // ── Checkout: sesión opcional para precargar datos ───────────
  if (pathname === '/checkout') {
    return handleSession(req, 'optional');
  }

  // ── Panel admin (sesión de nume con rol admin) ───────────────
  // El login siempre pasa.
  if (pathname === '/admin/login' || pathname === '/api/admin/login') {
    return NextResponse.next();
  }

  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    return handleSession(req, 'admin');
  }

  return handleSession(req, 'optional');
}

export const config = {
  matcher: [
    '/api/admin/:path*',
    '/api/cuenta/session',
    '/api/cuenta/reenviar-verificacion',
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map|txt|xml|json|woff2?|ttf|eot)).*)',
  ],
};
