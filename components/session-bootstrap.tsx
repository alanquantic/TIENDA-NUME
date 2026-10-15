'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function SessionBootstrap() {
  const router = useRouter();

  useEffect(() => {
    let pending = false;
    let disposed = false;
    let authenticated: boolean | null = null;
    const refresh = async () => {
      if (pending || document.visibilityState !== 'visible') return;
      pending = true;
      try {
        const response = await fetch('/api/cuenta/session', { credentials: 'include', cache: 'no-store' });
        if (disposed || (!response.ok && response.status !== 401)) return;
        const next = response.ok;
        if (authenticated !== null && next !== authenticated) router.refresh();
        authenticated = next;
      } catch {
        // Retry when connectivity returns, without closing the session.
      } finally {
        pending = false;
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 5 * 60_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [router]);

  return null;
}
