/**
 * Ruta pública del panel admin.
 *
 * Por defecto es /admin. Con ADMIN_PATH (p. ej. "gestion-x7k2") el panel se
 * sirve en /gestion-x7k2 y /admin responde 404, para que los bots que prueban
 * rutas conocidas no encuentren el login. Internamente las páginas siguen en
 * app/admin: el middleware traduce la ruta pública a la interna.
 *
 * No sustituye la autenticación: solo reduce el ruido. Compatible con edge.
 */

export const INTERNAL_ADMIN_BASE = '/admin';

// Primer segmento de rutas que ya existen en la tienda: no pueden ser el panel.
const RESERVED = new Set(['admin', 'api', 'carrito', 'checkout', 'cuenta', 'images', 'productos', '_next']);

/** Normaliza ADMIN_PATH; null si viene vacía o no es un segmento válido. */
export function parseAdminPath(value: string | undefined): string | null {
  const segment = (value ?? '').trim().replace(/^["'/]+|["'/]+$/g, '').toLowerCase();
  if (!segment) return null;
  if (!/^[a-z0-9][a-z0-9-]{2,62}$/.test(segment) || RESERVED.has(segment)) {
    console.error(`[admin] ADMIN_PATH "${value}" no es válida; el panel sigue en /admin.`);
    return null;
  }
  return segment;
}

export const ADMIN_BASE = `/${parseAdminPath(process.env.ADMIN_PATH) ?? 'admin'}`;

/** Enlace público dentro del panel: adminHref('/pedidos') → '/gestion-x7k2/pedidos'. */
export function adminHref(path = '/', base = ADMIN_BASE): string {
  if (!path || path === '/') return base;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function isUnder(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

export type AdminRoute =
  | { kind: 'panel'; internalPath: string }
  | { kind: 'hidden' }
  | { kind: 'other' };

/**
 * Clasifica una ruta pública: del panel (con su ruta interna /admin/...),
 * /admin oculto (debe responder 404) o cualquier otra.
 */
export function classifyAdminRoute(pathname: string, base = ADMIN_BASE): AdminRoute {
  if (isUnder(pathname, base)) {
    return { kind: 'panel', internalPath: `${INTERNAL_ADMIN_BASE}${pathname.slice(base.length)}` };
  }
  if (base !== INTERNAL_ADMIN_BASE && isUnder(pathname, INTERNAL_ADMIN_BASE)) return { kind: 'hidden' };
  return { kind: 'other' };
}
