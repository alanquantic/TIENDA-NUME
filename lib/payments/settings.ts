import { db } from '../db';
import { paymentSettings } from '../db/schema';

/**
 * Métodos de pago configurables desde /admin/pagos.
 *
 * Las llaves secretas viven en variables de entorno (Vercel), separadas por
 * modo. La BD solo guarda si el método está activo y en qué modo opera, así que
 * una filtración de la BD no expone credenciales.
 */

export type PaymentMethod = 'mercadopago' | 'paypal';
export type PaymentMode = 'sandbox' | 'production';

export const PAYMENT_METHODS: readonly PaymentMethod[] = ['mercadopago', 'paypal'];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  mercadopago: 'Mercado Pago',
  paypal: 'PayPal',
};

/** Variables de entorno que necesita cada método en cada modo. */
export const PAYMENT_ENV_VARS: Record<PaymentMethod, Record<PaymentMode, string[]>> = {
  mercadopago: {
    sandbox: ['MERCADOPAGO_ACCESS_TOKEN_TEST'],
    production: ['MERCADOPAGO_ACCESS_TOKEN'],
  },
  paypal: {
    sandbox: ['PAYPAL_CLIENT_ID_SANDBOX', 'PAYPAL_CLIENT_SECRET_SANDBOX'],
    production: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'],
  },
};

/** Variables opcionales (verificación de webhooks), por método y modo. */
export const PAYMENT_OPTIONAL_ENV_VARS: Record<PaymentMethod, Record<PaymentMode, string[]>> = {
  mercadopago: {
    sandbox: ['MERCADOPAGO_WEBHOOK_SECRET_TEST'],
    production: ['MERCADOPAGO_WEBHOOK_SECRET'],
  },
  paypal: {
    sandbox: ['PAYPAL_WEBHOOK_ID_SANDBOX'],
    production: ['PAYPAL_WEBHOOK_ID'],
  },
};

export function env(name: string): string {
  return (process.env[name] ?? '').trim();
}

export function missingEnvVars(method: PaymentMethod, mode: PaymentMode): string[] {
  return PAYMENT_ENV_VARS[method][mode].filter((name) => !env(name));
}

export function isConfigured(method: PaymentMethod, mode: PaymentMode): boolean {
  return missingEnvVars(method, mode).length === 0;
}

export type PaymentMethodSetting = {
  method: PaymentMethod;
  label: string;
  isEnabled: boolean;
  mode: PaymentMode;
  sortOrder: number;
  configured: boolean;
};

function asMode(value: string | null | undefined): PaymentMode {
  return value === 'production' ? 'production' : 'sandbox';
}

/** Configuración de todos los métodos (los que no tienen fila salen inactivos). */
export async function getPaymentSettings(): Promise<PaymentMethodSetting[]> {
  const rows = await db.select().from(paymentSettings);
  const byProvider = new Map(rows.map((row) => [row.provider, row]));

  return PAYMENT_METHODS.map((method, index) => {
    const row = byProvider.get(method);
    const mode = asMode(row?.mode);
    return {
      method,
      label: PAYMENT_METHOD_LABEL[method],
      isEnabled: row?.isEnabled ?? false,
      mode,
      sortOrder: row?.sortOrder ?? index,
      configured: isConfigured(method, mode),
    };
  }).sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Métodos que el cliente puede elegir en el checkout: activos y con llaves. */
export async function getAvailablePaymentMethods(): Promise<PaymentMethodSetting[]> {
  return (await getPaymentSettings()).filter((s) => s.isEnabled && s.configured);
}

export async function getPaymentMode(method: PaymentMethod): Promise<PaymentMode> {
  const setting = (await getPaymentSettings()).find((s) => s.method === method);
  return setting?.mode ?? 'sandbox';
}
