/**
 * Cookie que marca que el admin ya pasó la verificación en dos pasos.
 *
 * Valor `userId.expira.firma` (HMAC-SHA256 con ADMIN_2FA_SECRET). Va ligada al
 * id de nume del admin: la sesión de otra cuenta en el mismo navegador no la
 * puede usar. Usa Web Crypto para que la valide el middleware (edge).
 */

export const ADMIN_MFA_COOKIE = 'nume_admin_mfa';
const TTL_SECONDS = 12 * 60 * 60;
const encoder = new TextEncoder();

/**
 * Secreto para firmar la cookie y cifrar los secretos TOTP. En Vercel es
 * obligatorio (null = sin configurar); en local usa uno fijo de desarrollo.
 */
export function adminMfaSecret(): string | null {
  const value = process.env.ADMIN_2FA_SECRET?.trim();
  if (value) return value;
  return process.env.VERCEL_ENV ? null : 'dev-admin-2fa-secret';
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload))));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createAdminMfaCookie(userId: string, now = Date.now()) {
  const secret = adminMfaSecret();
  if (!secret) throw new Error('ADMIN_2FA_SECRET no está configurado.');
  const payload = `${userId}.${Math.floor(now / 1000) + TTL_SECONDS}`;
  return {
    name: ADMIN_MFA_COOKIE,
    value: `${payload}.${await sign(payload, secret)}`,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TTL_SECONDS,
  };
}

/** true si la cookie es auténtica, vigente y del mismo usuario. */
export async function verifyAdminMfaCookie(
  value: string | undefined,
  userId: string,
  now = Date.now(),
): Promise<boolean> {
  const secret = adminMfaSecret();
  if (!value || !secret || !userId) return false;
  const [cookieUser, expiresAt, signature] = value.split('.');
  if (!cookieUser || !expiresAt || !signature || cookieUser !== userId) return false;
  const exp = Number(expiresAt);
  if (!Number.isFinite(exp) || exp * 1000 < now) return false;
  return safeEqual(await sign(`${cookieUser}.${expiresAt}`, secret), signature);
}

export const clearedAdminMfaCookie = { name: ADMIN_MFA_COOKIE, value: '', maxAge: 0, path: '/' };
