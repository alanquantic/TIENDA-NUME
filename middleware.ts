import { NextResponse, type NextRequest } from 'next/server';
import {
  ACCESS_COOKIE,
  NUME_API_BASE_URL,
  REFRESH_COOKIE,
  sessionCookieOptions,
} from '@/lib/nume-auth';

const ADMIN_COOKIE = 'admin_session';

type AuthSessionResponse = {
  access_token: string;
  refresh_token: string;
};

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

/**
 * Protege /cuenta con la sesión de la API de nume. Si el access token expiró
 * pero hay refresh token, renueva la sesión y propaga los tokens nuevos al
 * MISMO request para que los Server Components rendericen con el token fresco.
 */
async function handleAccount(req: NextRequest) {
  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;

  if (!accessToken && !refreshToken) {
    return redirectToAccountLogin(req);
  }

  if (accessToken) {
    const meResponse = await fetchMe(accessToken);
    if (meResponse.ok) return NextResponse.next();
    if (meResponse.status !== 401) {
      // La API está caída o con errores: no cerrar la sesión por eso.
      return NextResponse.next();
    }
  }

  if (!refreshToken) {
    return redirectToAccountLogin(req);
  }

  const refreshResponse = await fetch(`${NUME_API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: 'no-store',
  });

  if (!refreshResponse.ok) {
    const redirect = redirectToAccountLogin(req);
    clearSessionCookies(redirect);
    return redirect;
  }

  const refreshed = (await refreshResponse.json()) as AuthSessionResponse;

  req.cookies.set(ACCESS_COOKIE, refreshed.access_token);
  req.cookies.set(REFRESH_COOKIE, refreshed.refresh_token);
  const res = NextResponse.next({ request: { headers: req.headers } });
  res.cookies.set({ name: ACCESS_COOKIE, value: refreshed.access_token, ...sessionCookieOptions });
  res.cookies.set({ name: REFRESH_COOKIE, value: refreshed.refresh_token, ...sessionCookieOptions });
  return res;
}

/**
 * Sesión opcional en /checkout: si hay cookies, renueva el access token vencido
 * para que el prefill del formulario funcione; si no hay sesión (o el refresh
 * falla), el checkout continúa como invitado — nunca redirige a login.
 */
async function handleOptionalSession(req: NextRequest) {
  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;

  if (!accessToken && !refreshToken) return NextResponse.next();

  if (accessToken) {
    const meResponse = await fetchMe(accessToken);
    if (meResponse.ok || meResponse.status !== 401) return NextResponse.next();
  }

  if (!refreshToken) return NextResponse.next();

  const refreshResponse = await fetch(`${NUME_API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: 'no-store',
  });

  if (!refreshResponse.ok) {
    const res = NextResponse.next();
    clearSessionCookies(res);
    return res;
  }

  const refreshed = (await refreshResponse.json()) as AuthSessionResponse;
  req.cookies.set(ACCESS_COOKIE, refreshed.access_token);
  req.cookies.set(REFRESH_COOKIE, refreshed.refresh_token);
  const res = NextResponse.next({ request: { headers: req.headers } });
  res.cookies.set({ name: ACCESS_COOKIE, value: refreshed.access_token, ...sessionCookieOptions });
  res.cookies.set({ name: REFRESH_COOKIE, value: refreshed.refresh_token, ...sessionCookieOptions });
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Cuenta del cliente (sesión de nume) ──────────────────────
  if (pathname.startsWith('/cuenta') && pathname !== '/cuenta/login') {
    return handleAccount(req);
  }

  // ── Checkout: sesión opcional para precargar datos ───────────
  if (pathname === '/checkout') {
    return handleOptionalSession(req);
  }

  // ── Panel admin (cookie local ADMIN_TOKEN) ───────────────────
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
  matcher: ['/admin/:path*', '/api/admin/:path*', '/cuenta/:path*', '/checkout'],
};
