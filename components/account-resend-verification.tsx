'use client';

import { useState } from 'react';

export function AccountResendVerification() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onResend() {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/cuenta/reenviar-verificacion', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setMessage(data.message ?? 'Revisa tu correo.');
      else setError(data.error ?? 'No pudimos enviar el correo.');
    } catch {
      setError('Error de red. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={onResend}
        disabled={loading}
        className="inline-flex items-center justify-center rounded-full bg-gradient-brand px-6 py-2.5 text-sm font-semibold text-white shadow transition hover:opacity-90 disabled:opacity-60"
      >
        {loading ? 'Enviando…' : 'Reenviar correo de confirmación'}
      </button>
      {message && <p className="text-sm text-[hsl(var(--muted-foreground))]">{message}</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
