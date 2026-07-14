import Link from 'next/link';
import type { Metadata } from 'next';
import { isAdminAuthed } from '@/lib/admin-auth';
import { LogoutButton } from '@/components/admin/logout-button';

export const metadata: Metadata = { title: 'Admin', robots: { index: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const authed = isAdminAuthed();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {authed && (
        <div className="mb-8 flex items-center justify-between border-b border-[hsl(var(--border))] pb-4">
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/admin" className="font-semibold">
              Productos
            </Link>
            <Link href="/admin/pedidos" className="hover:opacity-70">
              Pedidos
            </Link>
            <Link href="/admin/cupones" className="hover:opacity-70">
              Cupones
            </Link>
            <Link href="/admin/productos/nuevo" className="hover:opacity-70">
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
  );
}
