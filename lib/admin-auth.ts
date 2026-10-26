import { cookies } from 'next/headers';
import { getSessionUser } from './nume-session';
import type { NumeUser } from './nume-auth';
import { ADMIN_MFA_COOKIE, verifyAdminMfaCookie } from './admin-mfa-cookie';

/**
 * El panel admin usa la misma sesión de la API de nume que /cuenta: solo entra
 * quien inicia sesión con una cuenta de nume con `role: 'admin'` y además pasa
 * la verificación en dos pasos de la tienda. La tienda no guarda contraseñas
 * de admin; se cambian desde nume.
 */
export function isAdminUser(user: Pick<NumeUser, 'role'> | null | undefined): boolean {
  return user?.role === 'admin';
}

/** Uso en Server Components / Route Handlers: sesión de admin con el 2FA hecho. */
export async function isAdminAuthed(): Promise<boolean> {
  const user = await getSessionUser();
  if (!user || !isAdminUser(user)) return false;
  return verifyAdminMfaCookie(cookies().get(ADMIN_MFA_COOKIE)?.value, user.id);
}
