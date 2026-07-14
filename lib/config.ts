/**
 * Configuración central leída de variables de entorno, con defaults seguros.
 * Importa desde aquí en vez de leer process.env disperso por el código.
 */

export const config = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3002',
  storeName: process.env.NEXT_PUBLIC_STORE_NAME ?? 'Tienda',
  currency: (process.env.DEFAULT_CURRENCY ?? 'USD').toUpperCase(),
  // Tasa de impuesto por defecto como fracción (0.16 = 16%).
  taxRate: clampRate(parseFloat(process.env.DEFAULT_TAX_RATE ?? '0')),
  downloadTokenSecret: process.env.DOWNLOAD_TOKEN_SECRET ?? 'dev-secret',
  // TEMPORAL: simula un pago exitoso sin pasarela real (mientras se integran
  // Mercado Pago / PayPal). Quitar cuando los pagos reales estén listos.
  simulatePayments: process.env.SIMULATE_PAYMENTS === 'true',
} as const;

function clampRate(value: number): number {
  if (Number.isNaN(value) || value < 0) return 0;
  if (value > 1) return value / 100; // toleran "16" en vez de "0.16"
  return value;
}

export const stripeConfig = {
  secretKey: process.env.STRIPE_SECRET_KEY ?? '',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
} as const;
