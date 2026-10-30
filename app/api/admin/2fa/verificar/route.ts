import { NextResponse } from 'next/server';
import { rejectCrossSite } from '@/lib/request-guard';
import { isAdminUser } from '@/lib/admin-auth';
import { verifySecondFactor } from '@/lib/admin-2fa';
import { createAdminMfaCookie } from '@/lib/admin-mfa-cookie';
import { getSessionUser } from '@/lib/nume-session';

export const runtime = 'nodejs';

/** Segundo paso del login: código de la app o uno de respaldo. */
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req, { requireJson: true });
  if (blocked) return blocked;

  const user = await getSessionUser();
  if (!user || !isAdminUser(user)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { code?: unknown };
  const code = typeof body.code === 'string' ? body.code : '';
  const result = await verifySecondFactor(user.id, code);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  const res = NextResponse.json({
    usedRecoveryCode: result.usedRecoveryCode ?? false,
    recoveryCodesLeft: result.recoveryCodesLeft ?? null,
  });
  res.cookies.set(await createAdminMfaCookie(user.id));
  return res;
}
