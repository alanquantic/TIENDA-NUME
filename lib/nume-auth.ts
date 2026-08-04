/**
 * Autenticación delegada a la API de nume (NestJS, Railway).
 *
 * La tienda NO maneja contraseñas ni usuarios propios: hace proxy del login a
 * la API y guarda los JWT (access + refresh) en cookies httpOnly del dominio
 * de la tienda. Los nombres de cookie son los mismos que usa WEB-NUME
 * (`nume_at` / `nume_rt`) para permitir SSO por dominio compartido a futuro.
 *
 * Este módulo debe seguir siendo compatible con el runtime edge (lo importa
 * `middleware.ts`): solo `fetch`, sin APIs de Node.
 */

export const NUME_API_BASE_URL = (
  process.env.NUME_API_BASE_URL ?? 'https://api-nume-production.up.railway.app/api/v1'
)
  .trim()
  .replace(/\/+$/, '');

export const ACCESS_COOKIE = 'nume_at';
export const REFRESH_COOKIE = 'nume_rt';

export type NumeMembershipTier = 'none' | 'membresia_180' | 'membresia_365';

export type NumeUser = {
  id: string;
  email: string;
  role: 'admin' | 'subscriber' | 'reader';
  current_membership: NumeMembershipTier;
  membership_expires_at: string | null;
  has_active_membership: boolean;
  metadata?: Record<string, unknown>;
};

export type NumeAuthSession = {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  user: NumeUser;
};

export class NumeApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'NumeApiError';
  }
}

async function numeFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${NUME_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    // La API responde ProblemDetails ({ title, detail, status }).
    let detail = '';
    try {
      const body = (await res.json()) as { detail?: string; title?: string; message?: string };
      detail = body.detail ?? body.title ?? body.message ?? '';
    } catch {
      // cuerpo no-JSON: se usa el mensaje genérico
    }
    throw new NumeApiError(res.status, detail || `Error ${res.status} de la API de nume`);
  }

  return (await res.json()) as T;
}

export function numeLogin(email: string, password: string): Promise<NumeAuthSession> {
  return numeFetch<NumeAuthSession>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function numeRefresh(refreshToken: string): Promise<NumeAuthSession> {
  return numeFetch<NumeAuthSession>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

export function numeMe(accessToken: string): Promise<NumeUser> {
  return numeFetch<NumeUser>('/auth/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

/** Invalida la sesión (refresh token) en la API. Best-effort. */
export async function numeLogout(accessToken: string): Promise<void> {
  try {
    await numeFetch('/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    // La sesión local se borra igual; no bloquea el logout.
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

/** Nombre para saludar al cliente, según los metadatos que guarda la API. */
export function displayNameOf(user: NumeUser): string | null {
  const meta = (user.metadata ?? {}) as {
    customer?: { full_name?: string | null; first_name?: string | null; last_name?: string | null };
    display_name?: string;
    first_name?: string;
  };
  const fromCustomer =
    meta.customer?.full_name ??
    [meta.customer?.first_name, meta.customer?.last_name].filter(Boolean).join(' ');
  return fromCustomer || meta.display_name || meta.first_name || null;
}
