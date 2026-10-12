'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type ShippingRateRow = {
  id: string;
  name: string;
  countries: string[];
  amount: string;
  freeOverAmount: string | null;
  isActive: boolean;
  sortOrder: number;
};

type Draft = {
  name: string;
  countries: string;
  amount: string;
  freeOverAmount: string;
  isActive: boolean;
  sortOrder: string;
};

const EMPTY: Draft = {
  name: '',
  countries: 'MX',
  amount: '',
  freeOverAmount: '',
  isActive: true,
  sortOrder: '0',
};

function toDraft(rate: ShippingRateRow): Draft {
  return {
    name: rate.name,
    countries: rate.countries.join(', '),
    amount: rate.amount,
    freeOverAmount: rate.freeOverAmount ?? '',
    isActive: rate.isActive,
    sortOrder: String(rate.sortOrder),
  };
}

function toPayload(d: Draft) {
  return {
    name: d.name,
    countries: d.countries
      .split(/[\s,]+/)
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean),
    amount: d.amount,
    freeOverAmount: d.freeOverAmount || null,
    isActive: d.isActive,
    sortOrder: Number(d.sortOrder) || 0,
  };
}

function errorMessage(data: { error?: string; details?: { fieldErrors?: Record<string, string[]> } }) {
  const field = Object.values(data.details?.fieldErrors ?? {}).flat()[0];
  return field ?? data.error ?? 'No se pudo guardar.';
}

export function ShippingRatesManager({
  rates,
  formatAmount,
}: {
  rates: ShippingRateRow[];
  /** Montos ya formateados por el servidor, por id ("amount" y "free"). */
  formatAmount: Record<string, { amount: string; free: string | null }>;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function startEdit(rate: ShippingRateRow) {
    setEditingId(rate.id);
    setDraft(toDraft(rate));
    setError(null);
  }

  function reset() {
    setEditingId(null);
    setDraft(EMPTY);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch(editingId ? `/api/admin/envios/${editingId}` : '/api/admin/envios', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toPayload(draft)),
    });
    if (res.ok) {
      reset();
      router.refresh();
    } else {
      setError(errorMessage(await res.json().catch(() => ({}))));
    }
    setLoading(false);
  }

  async function toggle(rate: ShippingRateRow) {
    await fetch(`/api/admin/envios/${rate.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toPayload({ ...toDraft(rate), isActive: !rate.isActive })),
    });
    router.refresh();
  }

  async function remove(rate: ShippingRateRow) {
    if (!window.confirm(`¿Eliminar la tarifa "${rate.name}"?`)) return;
    await fetch(`/api/admin/envios/${rate.id}`, { method: 'DELETE' });
    if (editingId === rate.id) reset();
    router.refresh();
  }

  const input = 'w-full rounded-lg border border-[hsl(var(--border))] bg-transparent px-3 py-2';
  const label = 'block text-sm text-[hsl(var(--muted-foreground))] mb-1';
  const set = (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [key]: key === 'isActive' ? e.target.checked : e.target.value }));

  return (
    <div className="space-y-8">
      {rates.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[hsl(var(--border))] p-6 text-sm text-[hsl(var(--muted-foreground))]">
          Aún no hay tarifas. Sin tarifas activas, los productos físicos no se pueden comprar.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
          <table className="w-full text-sm">
            <thead className="border-b border-[hsl(var(--border))] text-left text-[hsl(var(--muted-foreground))]">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Países</th>
                <th className="px-4 py-3 font-medium">Costo</th>
                <th className="px-4 py-3 font-medium">Gratis desde</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {rates.map((r) => (
                <tr key={r.id} className={editingId === r.id ? 'bg-[hsl(var(--primary-soft))]' : ''}>
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3">
                    {r.countries.length ? (
                      r.countries.join(', ')
                    ) : (
                      <span className="text-[hsl(var(--muted-foreground))]">Todos</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{formatAmount[r.id]?.amount}</td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                    {formatAmount[r.id]?.free ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggle(r)}
                      className={r.isActive ? 'text-green-600 hover:underline' : 'text-[hsl(var(--muted-foreground))] hover:underline'}
                      title="Cambiar estado"
                    >
                      {r.isActive ? 'Activa' : 'Inactiva'}
                    </button>
                  </td>
                  <td className="space-x-3 whitespace-nowrap px-4 py-3 text-right">
                    <button type="button" onClick={() => startEdit(r)} className="hover:underline">
                      Editar
                    </button>
                    <button type="button" onClick={() => remove(r)} className="text-red-500 hover:underline">
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={submit} className="max-w-xl space-y-4 rounded-xl border border-[hsl(var(--border))] p-5">
        <h2 className="font-medium">{editingId ? 'Editar tarifa' : 'Nueva tarifa'}</h2>
        <div>
          <label className={label}>Nombre (lo ve el cliente)</label>
          <input required value={draft.name} onChange={set('name')} placeholder="Envío estándar (México)" className={input} />
        </div>
        <div>
          <label className={label}>Países (códigos de 2 letras separados por coma)</label>
          <input value={draft.countries} onChange={set('countries')} placeholder="MX" className={input} />
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            Ej. <code>MX</code> o <code>US, CA</code>. Déjalo vacío para que aplique a cualquier país.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Costo</label>
            <input required inputMode="decimal" value={draft.amount} onChange={set('amount')} placeholder="150.00" className={input} />
          </div>
          <div>
            <label className={label}>Gratis desde (opcional)</label>
            <input inputMode="decimal" value={draft.freeOverAmount} onChange={set('freeOverAmount')} placeholder="1500.00" className={input} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Orden en el checkout</label>
            <input type="number" min={0} value={draft.sortOrder} onChange={set('sortOrder')} className={input} />
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" checked={draft.isActive} onChange={set('isActive')} className="h-4 w-4 accent-[hsl(var(--primary))]" />
            Activa
          </label>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[hsl(var(--primary))] px-5 py-2.5 font-medium text-[hsl(var(--primary-foreground))] disabled:opacity-50"
          >
            {loading ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear tarifa'}
          </button>
          {editingId && (
            <button type="button" onClick={reset} className="px-3 text-sm hover:underline">
              Cancelar
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
