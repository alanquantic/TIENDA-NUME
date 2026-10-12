import { headers } from 'next/headers';
import { config } from '@/lib/config';
import {
  env,
  getPaymentSettings,
  PAYMENT_ENV_VARS,
  PAYMENT_OPTIONAL_ENV_VARS,
  type PaymentMode,
} from '@/lib/payments/settings';
import { PaymentMethodCard } from '@/components/admin/payment-method-card';

export const dynamic = 'force-dynamic';

const MODES: PaymentMode[] = ['sandbox', 'production'];

function statusOf(vars: Record<PaymentMode, string[]>) {
  return Object.fromEntries(
    MODES.map((mode) => [mode, vars[mode].map((name) => ({ name, set: !!env(name) }))]),
  ) as Record<PaymentMode, { name: string; set: boolean }[]>;
}

function siteOrigin(): string {
  const configured = config.appUrl.replace(/\/$/, '');
  if (!/localhost|127\.0\.0\.1/.test(configured)) return configured;
  const host = headers().get('host');
  return host ? `https://${host}` : configured;
}

export default async function AdminPayments() {
  const settings = await getPaymentSettings();
  const origin = siteOrigin();

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Métodos de pago</h1>
        <p className="max-w-2xl text-sm text-[hsl(var(--muted-foreground))]">
          Activa los métodos que verán tus clientes en el checkout. Las llaves secretas se
          guardan en las variables de entorno de Vercel (Settings → Environment Variables), no
          aquí; después de agregarlas hay que volver a desplegar.
        </p>
        {config.simulatePayments && (
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            SIMULATE_PAYMENTS está activo: el checkout simula compras y no usa estos métodos.
          </p>
        )}
      </div>

      {settings.map((s) => (
        <PaymentMethodCard
          key={s.method}
          method={s.method}
          label={s.label}
          isEnabled={s.isEnabled}
          mode={s.mode}
          envStatus={statusOf(PAYMENT_ENV_VARS[s.method])}
          optionalEnvStatus={statusOf(PAYMENT_OPTIONAL_ENV_VARS[s.method])}
          // Mercado Pago recibe la URL de aviso en cada cobro; PayPal se registra en su panel.
          webhookUrls={
            s.method === 'paypal'
              ? {
                  sandbox: `${origin}/api/webhooks/paypal?mode=sandbox`,
                  production: `${origin}/api/webhooks/paypal?mode=production`,
                }
              : null
          }
          webhookEvents={
            s.method === 'paypal' ? ['CHECKOUT.ORDER.APPROVED', 'PAYMENT.CAPTURE.COMPLETED'] : undefined
          }
        />
      ))}
    </div>
  );
}
