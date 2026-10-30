'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CouponEmailLimit({ id, code, limit }: { id: string; code: string; limit: number | null }) {
  const router = useRouter();
  const [value, setValue] = useState(limit == null ? '' : String(limit));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  return (
    <form className="space-y-2 min-w-40" onSubmit={async (event) => {
      event.preventDefault();
      setSaving(true);
      setMessage('');
      try {
        const response = await fetch('/api/admin/cupones', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, maxRedemptionsPerEmail: value ? Number(value) : null }),
        });
        if (!response.ok) throw new Error('No se pudo guardar el límite.');
        setMessage('Guardado.');
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'No se pudo guardar.');
      } finally { setSaving(false); }
    }}>
      <input type="number" min="1" max="2147483647" step="1" value={value}
        aria-label={`Máx. usos por correo de ${code}`} placeholder="Sin límite" disabled={saving}
        onChange={event => { setValue(event.target.value); setMessage(''); }}
        className="w-32 rounded border border-[hsl(var(--border))] bg-transparent px-2 py-1" />
      <button type="submit" disabled={saving} className="block text-xs underline disabled:opacity-50">
        {saving ? 'Guardando…' : 'Guardar límite'}
      </button>
      <p aria-live="polite" className="text-xs">{message}</p>
    </form>
  );
}
