/**
 * URL pública del sitio de nume (WEB-NUME). La cuenta se administra allá:
 * datos, contraseña y suscripción. Cambia el valor con NEXT_PUBLIC_NUME_SITE_URL
 * si el dominio de producción difiere.
 */
export const NUME_SITE_URL = (
  process.env.NEXT_PUBLIC_NUME_SITE_URL ?? 'https://web-nume.vercel.app'
)
  .trim()
  .replace(/\/+$/, '');
