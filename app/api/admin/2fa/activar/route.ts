import { NextResponse } from 'next/server';
import { rejectCrossSite } from '@/lib/request-guard';
import { isAdminUser } from '@/lib/admin-auth';
import { confirmEnrollment } from '@/lib/admin-2fa';
import { createAdminMfaCookie } from '@/lib/admin-mfa-cookie';
import { sendTwoFactorEnabledNotice } from '@/lib/email';
import { getSessionUser } from '@/lib/nume-session';

export const runtime = 'nodejs';

/** Confirma la app autenticadora con su primer código y devuelve los códigos de respaldo. */
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req, { requireJson: true });
  if (blocked) return blocked;

  const user = await getSessionUser();
  if (!user || !isAdminUser(user)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { code?: unknown };
  const code = typeof body.code === 'string' ? body.code : '';
  const result = await confirmEnrollment(user.id, code);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  // Si alguien con la contraseña configuró la app antes que su dueño, este aviso lo delata.
  await sendTwoFactorEnabledNotice({ email: user.email });

  const res = NextResponse.json({ recoveryCodes: result.recoveryCodes });
  res.cookies.set(await createAdminMfaCookie(user.id));
  return res;
}
