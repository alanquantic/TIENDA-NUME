'use client';

import { useEffect, useState, type ReactNode } from 'react';

/** Días, horas, minutos y segundos que faltan para `endsAt` (nunca negativos). */
export function remainingParts(endsAt: number, now: number): [number, number, number, number] {
  const seconds = Math.max(0, Math.floor((endsAt - now) / 1000));
  return [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60];
}

const LABELS = ['Días', 'Horas', 'Min', 'Seg'];

/**
 * Cuenta regresiva al fin de una oferta. Envuelve a `children` (el texto que la
 * acompaña) para que todo el bloque desaparezca solo cuando la oferta vence.
 *  - `tone="soft"`: sobre fondos del tema (ficha de producto).
 *  - `tone="promo"`: sobre el banner rojo de promoción.
 */
export function SaleCountdown({
  endsAt,
  tone = 'soft',
  label = 'Tiempo restante de la oferta',
  className = '',
  children,
}: {
  endsAt: string;
  tone?: 'soft' | 'promo';
  label?: string;
  className?: string;
  children?: ReactNode;
}) {
  const end = Date.parse(endsAt);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (time >= end) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [end]);

  if (Number.isNaN(end)) return null;
  if (now !== null && now >= end) return null;
  const parts = now === null ? null : remainingParts(end, now);

  const box =
    tone === 'promo'
      ? 'bg-[hsl(var(--promo-foreground))] text-[hsl(var(--promo))]'
      : 'border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--primary))]';
  const caption = tone === 'promo' ? 'text-[hsl(var(--promo-foreground))]' : 'text-[hsl(var(--muted-foreground))]';

  return (
    <div className={className}>
      {children}
      <div role="timer" aria-live="off" aria-label={label} className="flex gap-1.5 sm:gap-2">
        {LABELS.map((unit, index) => (
          <div key={unit} className="w-12 text-center sm:w-14">
            <span className={`block rounded-lg py-1.5 text-xl font-bold tabular-nums sm:text-2xl ${box}`}>
              {parts ? String(parts[index]).padStart(2, '0') : '—'}
            </span>
            <span className={`mt-1 block text-[0.7rem] font-medium uppercase tracking-wide ${caption}`}>{unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
