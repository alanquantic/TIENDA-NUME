import { cache } from 'react';
import { cookies } from 'next/headers';
import { ACCESS_COOKIE, NumeApiError, numeMe, type NumeUser } from './nume-auth';

/**
 * Usuario autenticado del request actual (Server Components / route handlers).
 * El refresh de tokens vencidos ocurre en `middleware.ts`; aquí solo se lee la
 * cookie vigente. `cache` evita llamadas repetidas a /auth/me en un render.
 */
export const getSessionUser = cache(async (): Promise<NumeUser | null> => {
  const accessToken = cookies().get(ACCESS_COOKIE)?.value;
  if (!accessToken) return null;

  try {
    return await numeMe(accessToken);
  } catch (error) {
    if (error instanceof NumeApiError && error.status === 401) return null;
    throw error;
  }
});
