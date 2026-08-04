'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AccountLogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onLogout() {
    setLoading(true);
    try {
      await fetch('/api/cuenta/logout', { method: 'POST' });
    } finally {
      router.push('/');
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={loading}
      className="rounded-full border border-[hsl(var(--border))] px-4 py-2 text-sm font-medium transition hover:bg-[hsl(var(--muted))] disabled:opacity-60"
    >
      {loading ? 'Cerrando sesión…' : 'Cerrar sesión'}
    </button>
  );
}
