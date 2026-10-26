'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Reencola un reporte en error/failed; el cron horario lo reenvía desde cero. */
export function ReportRetryButton({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/reportes/${reportId}/reintentar`, { method: 'POST' });
    if (res.ok) {
      router.refresh();
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? 'No se pudo reintentar.');
    }
    setLoading(false);
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={retry}
        disabled={loading}
        className="rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-sm font-medium hover:bg-[hsl(var(--muted))] disabled:opacity-50"
      >
        {loading ? 'Reintentando…' : 'Reintentar'}
      </button>
      {error && <p className="max-w-[16rem] text-right text-xs text-red-500">{error}</p>}
    </div>
  );
}
