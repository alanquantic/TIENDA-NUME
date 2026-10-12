import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from './config';

/**
 * Acceso del comprador a la página de éxito de SU pedido.
 *
 * El id del pedido ya no viaja en la URL (se filtraba a historial, analítica y
 * pasarelas): al crear el pedido se fija una cookie httpOnly firmada con
 * `orderId.expira.firma`. `/checkout/success` solo muestra detalle y descargas
 * si la cookie es válida; sin ella pide revisar el correo o entrar a /cuenta.
 */

export const ORDER_ACCESS_COOKIE = 'nume_order';
const TTL_SECONDS = 24 * 60 * 60;

function secret(): string {
  const value = config.downloadTokenSecret;
  if (process.env.VERCEL_ENV === 'production' && (!value || value === 'dev-secret')) {
    throw new Error('DOWNLOAD_TOKEN_SECRET no está configurado en producción.');
  }
  return value;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function orderAccessCookie(orderId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const payload = `${orderId}.${expiresAt}`;
  return {
    name: ORDER_ACCESS_COOKIE,
    value: `${payload}.${sign(payload)}`,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TTL_SECONDS,
  };
}

/** Devuelve el id del pedido si la cookie es auténtica y no ha expirado. */
export function readOrderAccess(value: string | undefined): string | null {
  if (!value) return null;
  const [orderId, expiresAt, signature] = value.split('.');
  if (!orderId || !expiresAt || !signature) return null;
  if (Number(expiresAt) * 1000 < Date.now()) return null;

  const expected = Buffer.from(sign(`${orderId}.${expiresAt}`));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  return orderId;
}
