import Link from 'next/link';
import type { Metadata } from 'next';
import { isAdminAuthed } from '@/lib/admin-auth';
import { ADMIN_BASE, adminHref } from '@/lib/admin-path';
import { AdminPathProvider } from '@/components/admin/admin-path';
import { LogoutButton } from '@/components/admin/logout-button';

export const metadata: Metadata = { title: 'Admin', robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authed = await isAdminAuthed();

  return (
    // data-admin-panel: la analítica no registra el panel aunque su ruta sea secreta.
    <AdminPathProvider base={ADMIN_BASE}>
      <div data-admin-panel className="mx-auto max-w-5xl px-4 py-8">
        {authed && (
          <div className="mb-8 flex items-center justify-between border-b border-[hsl(var(--border))] pb-4">
            <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <Link href={adminHref()} className="font-semibold">
                Productos
              </Link>
              <Link href={adminHref('/pedidos')} className="hover:opacity-70">
                Pedidos
              </Link>
              <Link href={adminHref('/metricas')} className="hover:opacity-70">
                Métricas
              </Link>
              <Link href={adminHref('/reportes')} className="hover:opacity-70">
                Reportes
              </Link>
              <Link href={adminHref('/correos')} className="hover:opacity-70">
                Correos
              </Link>
              <Link href={adminHref('/cupones')} className="hover:opacity-70">
                Cupones
              </Link>
              <Link href={adminHref('/envios')} className="hover:opacity-70">
                Envíos
              </Link>
              <Link href={adminHref('/pagos')} className="hover:opacity-70">
                Pagos
              </Link>
              <Link href={adminHref('/productos/nuevo')} className="hover:opacity-70">
                + Nuevo
              </Link>
              <Link href="/" className="hover:opacity-70 text-[hsl(var(--muted-foreground))]">
                Ver tienda ↗
              </Link>
            </nav>
            <LogoutButton />
          </div>
        )}
        {children}
      </div>
    </AdminPathProvider>
  );
}
