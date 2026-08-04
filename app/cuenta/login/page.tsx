import Link from 'next/link';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { AccountLoginForm } from '@/components/account-login-form';
import { getSessionUser } from '@/lib/nume-session';
import { NUME_SITE_URL } from '@/lib/nume-site';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Iniciar sesión' };

export default async function AccountLoginPage() {
  const user = await getSessionUser();
  if (user) redirect('/cuenta');

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-center text-3xl font-semibold tracking-tight">Mi cuenta</h1>
      <p className="mt-2 text-center text-[hsl(var(--muted-foreground))]">
        Inicia sesión con tu cuenta de Numerología Cotidiana para ver tus pedidos,
        descargas y reportes.
      </p>

      <div className="mt-8 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
        <Suspense>
          <AccountLoginForm />
        </Suspense>

        <div className="mt-5 space-y-2 border-t border-[hsl(var(--border))] pt-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
          <p>
            <a
              href={`${NUME_SITE_URL}/olvide-contrasena`}
              className="underline underline-offset-4 hover:text-[hsl(var(--primary))]"
            >
              ¿Olvidaste tu contraseña?
            </a>
          </p>
          <p>
            ¿No tienes cuenta?{' '}
            <a
              href={`${NUME_SITE_URL}/registro`}
              className="underline underline-offset-4 hover:text-[hsl(var(--primary))]"
            >
              Créala en el sitio de nume
            </a>
          </p>
          <p className="text-xs leading-5">
            Si compraste una membresía, tu cuenta se creó automáticamente: busca en tu
            correo el mensaje de bienvenida con tu contraseña.
          </p>
        </div>
      </div>

      <p className="mt-6 text-center text-sm">
        <Link href="/" className="underline underline-offset-4">
          Volver a la tienda
        </Link>
      </p>
    </div>
  );
}
