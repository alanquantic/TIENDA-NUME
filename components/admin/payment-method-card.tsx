'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Mode = 'sandbox' | 'production';

export type PaymentMethodCardProps = {
  method: 'mercadopago' | 'paypal';
  label: string;
  isEnabled: boolean;
  mode: Mode;
  /** Variables requeridas por modo, con si están definidas en el servidor. */
  envStatus: Record<Mode, { name: string; set: boolean }[]>;
  optionalEnvStatus: Record<Mode, { name: string; set: boolean }[]>;
  /** URL de webhook a registrar en el panel del proveedor (null = no hace falta). */
  webhookUrls: Record<Mode, string> | null;
  webhookEvents?: string[];
};

const MODE_LABEL: Record<Mode, string> = { sandbox: 'Prueba (sandbox)', production: 'Producción' };

export function PaymentMethodCard(props: PaymentMethodCardProps) {
  const router = useRouter();
  const [isEnabled, setIsEnabled] = useState(props.isEnabled);
  const [mode, setMode] = useState<Mode>(props.mode);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const configured = props.envStatus[mode].every((v) => v.set);
  const dirty = isEnabled !== props.isEnabled || mode !== props.mode;

  async function save() {
    setError(null);
    setSaved(false);
    setLoading(true);
    const res = await fetch('/api/admin/pagos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: props.method, isEnabled, mode }),
    });
    if (res.ok) {
      setSaved(true);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'No se pudo guardar.');
    }
    setLoading(false);
  }

  const label = 'block text-sm text-[hsl(var(--muted-foreground))] mb-1';
  const input = 'w-full rounded-lg border border-[hsl(var(--border))] bg-transparent px-3 py-2';

  return (
    <section className="space-y-5 rounded-xl border border-[hsl(var(--border))] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{props.label}</h2>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            props.isEnabled
              ? 'bg-green-600/10 text-green-700 dark:text-green-400'
              : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'
          }`}
        >
          {props.isEnabled
            ? `Activo · ${props.mode === 'production' ? 'producción' : 'prueba'}`
            : 'Inactivo'}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[hsl(var(--border))] px-3 py-2">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => setIsEnabled(e.target.checked)}
            className="h-4 w-4 accent-[hsl(var(--primary))]"
          />
          <span className="text-sm">Mostrar en el checkout</span>
        </label>
        <div>
          <label className={label}>Modo</label>
          <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} className={input}>
            <option value="sandbox">{MODE_LABEL.sandbox}</option>
            <option value="production">{MODE_LABEL.production}</option>
          </select>
        </div>
      </div>

      {mode === 'production' && isEnabled && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          En producción se hacen cobros reales.
        </p>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium">Llaves en Vercel para modo {MODE_LABEL[mode].toLowerCase()}</p>
        <ul className="space-y-1 text-sm">
          {props.envStatus[mode].map((v) => (
            <li key={v.name} className="flex items-center gap-2">
              <span className={v.set ? 'text-green-600' : 'text-red-500'}>{v.set ? '✓' : '✗'}</span>
              <code className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-xs">{v.name}</code>
              {!v.set && <span className="text-[hsl(var(--muted-foreground))]">falta</span>}
            </li>
          ))}
          {props.optionalEnvStatus[mode].map((v) => (
            <li key={v.name} className="flex items-center gap-2">
              <span className={v.set ? 'text-green-600' : 'text-[hsl(var(--muted-foreground))]'}>
                {v.set ? '✓' : '○'}
              </span>
              <code className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-xs">{v.name}</code>
              <span className="text-[hsl(var(--muted-foreground))]">opcional · verifica la firma de los avisos</span>
            </li>
          ))}
        </ul>
      </div>

      {props.webhookUrls && (
        <div className="space-y-1 text-sm">
          <p className="font-medium">Webhook a registrar en {props.label}</p>
          <code className="block break-all rounded bg-[hsl(var(--muted))] px-2 py-1.5 text-xs">
            {props.webhookUrls[mode]}
          </code>
          {props.webhookEvents && (
            <p className="text-[hsl(var(--muted-foreground))]">
              Eventos: {props.webhookEvents.join(', ')}
            </p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
      {saved && !dirty && <p className="text-sm text-green-600">Guardado.</p>}
      <button
        type="button"
        onClick={save}
        disabled={loading || !dirty || (isEnabled && !configured)}
        className="rounded-lg bg-[hsl(var(--primary))] px-5 py-2.5 font-medium text-[hsl(var(--primary-foreground))] disabled:opacity-50"
      >
        {loading ? 'Guardando…' : 'Guardar'}
      </button>
      {isEnabled && !configured && (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Agrega las llaves que faltan en Vercel y vuelve a desplegar para poder activarlo.
        </p>
      )}
    </section>
  );
}
