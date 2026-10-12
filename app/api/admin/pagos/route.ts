import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paymentSettings } from '@/lib/db/schema';
import { adminPaymentSettingSchema } from '@/lib/validation';
import { missingEnvVars, PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from '@/lib/payments/settings';

export const runtime = 'nodejs';

/** Activa/desactiva un método de pago y fija su modo (prueba/producción). */
export async function PUT(req: Request) {
  const parsed = adminPaymentSettingSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos.', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { method, isEnabled, mode } = parsed.data;

  const missing = missingEnvVars(method, mode);
  if (isEnabled && missing.length > 0) {
    return NextResponse.json(
      {
        error: `No se puede activar ${PAYMENT_METHOD_LABEL[method]} en modo ${
          mode === 'production' ? 'producción' : 'prueba'
        }: faltan las variables ${missing.join(', ')} en Vercel.`,
      },
      { status: 409 },
    );
  }

  await db
    .insert(paymentSettings)
    .values({ provider: method, isEnabled, mode, sortOrder: PAYMENT_METHODS.indexOf(method) })
    .onConflictDoUpdate({
      target: paymentSettings.provider,
      set: { isEnabled, mode, updatedAt: new Date() },
    });

  return NextResponse.json({ ok: true });
}
