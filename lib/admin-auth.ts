import { cookies } from 'next/headers';

export const ADMIN_COOKIE = 'admin_session';

/** Token de sesión esperado (valor que se guarda en la cookie tras login). */
export function adminToken(): string {
  return process.env.ADMIN_TOKEN ?? '';
}

export function adminPassword(): string {
  return process.env.ADMIN_PASSWORD ?? '';
}

/** ¿La cookie coincide con el token de admin? (comparación simple de string). */
export function isValidAdminCookie(value: string | undefined): boolean {
  const token = adminToken();
  return token.length > 0 && value === token;
}

/** Uso en Server Components / Route Handlers. */
export function isAdminAuthed(): boolean {
  return isValidAdminCookie(cookies().get(ADMIN_COOKIE)?.value);
}
