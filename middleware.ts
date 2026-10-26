import { NextResponse, type NextRequest } from 'next/server';
import { adminHref, classifyAdminRoute } from '@/lib/admin-path';
import { ADMIN_MFA_COOKIE, verifyAdminMfaCookie } from '@/lib/admin-mfa-cookie';
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

type MeResponse = { id?: string; role?: string };

type SessionOptions = {
  /** Ruta interna a servir cuando el panel vive en ADMIN_PATH. */
  rewriteTo?: URL;
  /** Exigir la cookie de verificación en dos pasos (todo el admin salvo el propio paso). */
  requireMfa?: boolean;
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
  res.cookies.set({ name: ADMIN_MFA_COOKIE, value: '', maxAge: 0, path: '/' });
}

async function fetchMe(accessToken: string) {
  return fetch(`${NUME_API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
}

/** Renew sessions before rendering, including public pages and API requests. */
async function handleSession(
  req: NextRequest,
  mode: 'optional' | 'account' | 'admin',
  { rewriteTo, requireMfa = false }: SessionOptions = {},
) {
  const isApi = req.nextUrl.pathname.startsWith('/api/');
  const pass = (init?: Parameters<typeof NextResponse.next>[0]) =>
    rewriteTo ? NextResponse.rewrite(rewriteTo, init) : NextResponse.next(init);
  const deny = (clear = false) => {
    const res = mode === 'optional'
      ? NextResponse.next()
      : isApi
        ? NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
        : mode === 'admin'
          ? NextResponse.redirect(new URL(adminHref('/login'), req.url))
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
    // Rotated tokens must reach the browser on every outcome, redirects included.
    const withRefreshed = (res: NextResponse) => {
      if (refreshed) {
        res.cookies.set(createAccessCookie(refreshed.access_token));
        res.cookies.set(createRefreshCookie(refreshed.refresh_token));
      }
      return res;
    };
    if (requireMfa && !(await verifyAdminMfaCookie(req.cookies.get(ADMIN_MFA_COOKIE)?.value, me.id ?? ''))) {
      return withRefreshed(isApi
        ? NextResponse.json({ error: 'Falta la verificación en dos pasos.' }, { status: 401 })
        : NextResponse.redirect(new URL(adminHref('/verificacion'), req.url)));
    }
    if (!refreshed) return pass();
    req.cookies.set(ACCESS_COOKIE, refreshed.access_token);
    req.cookies.set(REFRESH_COOKIE, refreshed.refresh_token);
    return withRefreshed(pass({ request: { headers: req.headers } }));
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

  // ── Panel admin (sesión de nume con rol admin + 2FA) ─────────
  // Con ADMIN_PATH el panel vive en esa ruta y /admin responde 404.
  const adminRoute = classifyAdminRoute(pathname);
  if (adminRoute.kind === 'hidden') {
    return NextResponse.rewrite(new URL('/_admin-no-existe', req.url));
  }
  if (adminRoute.kind === 'panel') {
    const internal = adminRoute.internalPath;
    const rewriteTo = internal === pathname ? undefined : new URL(`${internal}${req.nextUrl.search}`, req.url);
    // El login siempre pasa; la verificación solo pide sesión de admin.
    const res = internal === '/admin/login'
      ? rewriteTo ? NextResponse.rewrite(rewriteTo) : NextResponse.next()
      : await handleSession(req, 'admin', { rewriteTo, requireMfa: internal !== '/admin/verificacion' });
    return withAdminHeaders(res);
  }

  if (pathname === '/api/admin/login') {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/admin')) {
    // El propio paso de verificación y salir no pueden exigir la verificación.
    const beforeMfa = pathname.startsWith('/api/admin/2fa/') || pathname === '/api/admin/logout';
    return handleSession(req, 'admin', { requireMfa: !beforeMfa });
  }

  return handleSession(req, 'optional');
}

/** El panel no se indexa ni manda su ruta como Referer a otros sitios. */
function withAdminHeaders(res: NextResponse) {
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  res.headers.set('Referrer-Policy', 'same-origin');
  return res;
}

export const config = {
  matcher: [
    '/api/admin/:path*',
    '/api/cuenta/session',
    '/api/cuenta/reenviar-verificacion',
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map|txt|xml|json|woff2?|ttf|eot)).*)',
  ],
};
