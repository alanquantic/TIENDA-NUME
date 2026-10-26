'use client';

import { useRouter } from 'next/navigation';
import { useAdminHref } from '@/components/admin/admin-path';

export function LogoutButton() {
  const router = useRouter();
  const adminHref = useAdminHref();
  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.replace(adminHref('/login'));
    router.refresh();
  }
  return (
    <button onClick={logout} className="text-sm text-[hsl(var(--muted-foreground))] hover:underline">
      Salir
    </button>
  );
}
