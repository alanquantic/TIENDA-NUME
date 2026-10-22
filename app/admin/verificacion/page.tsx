import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { getAdminTwoFactor, pendingTotpSecret } from '@/lib/admin-2fa';
import { isAdminUser } from '@/lib/admin-auth';
import { ADMIN_MFA_COOKIE, adminMfaSecret, verifyAdminMfaCookie } from '@/lib/admin-mfa-cookie';
import { adminHref } from '@/lib/admin-path';
import { getSessionUser } from '@/lib/nume-session';
import { otpauthUri } from '@/lib/totp';
import { LogoutButton } from '@/components/admin/logout-button';
import { TwoFactorForm } from '@/components/admin/two-factor-form';

export const dynamic = 'force-dynamic';

const ISSUER = 'Tienda Numerología Cotidiana';

export default async function AdminVerificationPage() {
  const user = await getSessionUser();
  if (!user || !isAdminUser(user)) redirect(adminHref('/login'));

  if (!adminMfaSecret()) {
    return (
      <div className="mx-auto max-w-md py-16 text-sm">
        <h1 className="mb-3 text-2xl font-semibold">Verificación en dos pasos</h1>
        <p className="text-[hsl(var(--muted-foreground))]">
          Falta configurar la variable <code>ADMIN_2FA_SECRET</code> en el servidor. Sin ella nadie puede entrar al panel.
        </p>
      </div>
    );
  }

  if (await verifyAdminMfaCookie(cookies().get(ADMIN_MFA_COOKIE)?.value, user.id)) {
    redirect(adminHref());
  }

  const row = await getAdminTwoFactor(user.id);
  let enrollment: { qrSvg: string; secret: string } | null = null;
  if (!row?.enabledAt) {
    const secret = await pendingTotpSecret(user);
    const qrSvg = await QRCode.toString(otpauthUri({ secret, account: user.email, issuer: ISSUER }), {
      type: 'svg',
      margin: 1,
      width: 200,
    });
    enrollment = { qrSvg, secret };
  }

  return (
    <div className="mx-auto max-w-md py-12">
      <TwoFactorForm email={user.email} enrollment={enrollment} />
      <div className="mt-8 text-center">
        <LogoutButton />
      </div>
    </div>
  );
}
