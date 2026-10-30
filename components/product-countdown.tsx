'use client';

import { useEffect, useState } from 'react';

// Cierre del 31 de octubre de 2026 en Ciudad de México (UTC−6).
export const OCTOBER_DEADLINE = '2026-11-01T00:00:00-06:00';

export function countdownParts(now: number) {
  const seconds = Math.max(0, Math.floor((Date.parse(OCTOBER_DEADLINE) - now) / 1000));
  return [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60];
}

export function ProductCountdown() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (time >= Date.parse(OCTOBER_DEADLINE)) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (now !== null && now >= Date.parse(OCTOBER_DEADLINE)) return null;
  const parts = now === null ? null : countdownParts(now);

  return (
    <section aria-label="Cuenta regresiva al 31 de octubre" className="mt-6 rounded-xl border border-[hsl(var(--primary)/0.2)] bg-[hsl(var(--primary-soft))] p-4 sm:p-5">
      <p className="text-center text-sm font-semibold text-[hsl(var(--primary))]">Cuenta regresiva al 31 de octubre</p>
      <div role="timer" aria-live="off" className="mx-auto mt-3 grid max-w-sm grid-cols-4 gap-2">
        {['Días', 'Horas', 'Minutos', 'Segundos'].map((label, index) => (
          <div key={label} className="text-center">
            <span className="block rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] py-2 text-2xl font-semibold tabular-nums text-[hsl(var(--primary))] sm:text-3xl">
              {parts ? String(parts[index]).padStart(2, '0') : '—'}
            </span>
            <span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">{label}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-[hsl(var(--muted-foreground))]">Hasta el 31 de octubre de 2026, 23:59 h · Ciudad de México</p>
    </section>
  );
}
