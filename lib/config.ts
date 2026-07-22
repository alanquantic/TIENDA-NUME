/**
 * Configuración central leída de variables de entorno, con defaults seguros.
 * Importa desde aquí en vez de leer process.env disperso por el código.
 */

/**
 * Interpreta una env var como booleano de forma tolerante. Acepta "true",
 * "1", "yes", "on" (en cualquier caso, con espacios o comillas alrededor).
 * Esto evita el clásico tropiezo en Vercel: pegar el valor como `"true"` con
 * comillas o `TRUE`, que con una comparación estricta `=== 'true'` fallaría.
 */
function envFlag(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().replace(/^["']|["']$/g, '').toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

export const config = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3002',
  storeName: process.env.NEXT_PUBLIC_STORE_NAME ?? 'Tienda',
  currency: (process.env.DEFAULT_CURRENCY ?? 'USD').toUpperCase(),
  downloadTokenSecret: process.env.DOWNLOAD_TOKEN_SECRET ?? 'dev-secret',
  // TEMPORAL: simula un pago exitoso sin pasarela real (mientras se integran
  // Mercado Pago / PayPal). Quitar cuando los pagos reales estén listos.
  simulatePayments: envFlag(process.env.SIMULATE_PAYMENTS),
} as const;

export const stripeConfig = {
  secretKey: process.env.STRIPE_SECRET_KEY ?? '',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
} as const;

export const emailConfig = {
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  // Remitente. En pruebas: "Tienda Nume <onboarding@resend.dev>" (solo entrega
  // al correo de tu cuenta Resend). En producción: un remitente de tu dominio
  // verificado, p. ej. "Tienda Nume <pedidos@numerologia-cotidiana.com>".
  from: process.env.EMAIL_FROM ?? 'Tienda Nume <onboarding@resend.dev>',
  replyTo: process.env.EMAIL_REPLY_TO || undefined,
} as const;
