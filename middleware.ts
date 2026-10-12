import { NextResponse, type NextRequest } from 'next/server';
import {
  ACCESS_COOKIE,
  NUME_API_BASE_URL,
  REFRESH_COOKIE,
  sessionCookieOptions,
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

/**
 * Protege /admin y /api/admin: exige una sesión de nume cuyo usuario tenga
 * `role: 'admin'`. Renueva el access token vencido igual que /cuenta. Si la API
 * de nume no responde, se niega el acceso (a diferencia de /cuenta).
 */
async function handleAdmin(req: NextRequest) {
  try {
    return await checkAdmin(req);
  } catch (error) {
    // API de nume caída o inalcanzable: se niega el acceso sin tumbar la página.
    console.error('[middleware] no se pudo validar la sesión admin:', error);
    return req.nextUrl.pathname.startsWith('/api/admin')
      ? NextResponse.json({ error: 'No se pudo validar la sesión.' }, { status: 503 })
      : NextResponse.redirect(new URL('/admin/login', req.url));
  }
}

async function checkAdmin(req: NextRequest) {
  const isApi = req.nextUrl.pathname.startsWith('/api/admin');
  const deny = (clearCookies = false) => {
    const res = isApi
      ? NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
      : NextResponse.redirect(new URL('/admin/login', req.url));
    if (clearCookies) clearSessionCookies(res);
    return res;
  };

  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  let refreshed: AuthSessionResponse | null = null;
  let meResponse = accessToken ? await fetchMe(accessToken) : null;

  // Sin access token o vencido (401): intenta renovar con el refresh token.
  if ((!meResponse || meResponse.status === 401) && refreshToken) {
    const refreshResponse = await fetch(`${NUME_API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: 'no-store',
    });
    if (!refreshResponse.ok) return deny(true);
    refreshed = (await refreshResponse.json()) as AuthSessionResponse;
    meResponse = await fetchMe(refreshed.access_token);
  }

  if (!meResponse?.ok) return deny();
  const me = (await meResponse.json()) as MeResponse;
  if (me.role !== 'admin') return deny();

  if (!refreshed) return NextResponse.next();

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

  // ── Panel admin (sesión de nume con rol admin) ───────────────
  // El login siempre pasa.
  if (pathname === '/admin/login' || pathname === '/api/admin/login') {
    return NextResponse.next();
  }

  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    return handleAdmin(req);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/cuenta/:path*', '/checkout'],
};
