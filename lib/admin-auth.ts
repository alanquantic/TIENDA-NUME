import { getSessionUser } from './nume-session';
import type { NumeUser } from './nume-auth';

/**
 * El panel admin usa la misma sesión de la API de nume que /cuenta: solo entra
 * quien inicia sesión con una cuenta de nume con `role: 'admin'`. La tienda no
 * guarda contraseñas de admin; se cambian desde nume.
 */
export function isAdminUser(user: Pick<NumeUser, 'role'> | null | undefined): boolean {
  return user?.role === 'admin';
}

/** Uso en Server Components / Route Handlers. */
export async function isAdminAuthed(): Promise<boolean> {
  return isAdminUser(await getSessionUser());
}
