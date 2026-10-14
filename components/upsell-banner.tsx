'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useUpsell } from '@/lib/upsell-store';

/**
 * Aviso fijo en la parte superior cuando se agrega al carrito una agenda
 * anterior: ofrece ir a la agenda 2027. Se cierra con la X, al seguir el
 * enlace o al cambiar de página.
 */
export function UpsellBanner() {
  const offer = useUpsell((s) => s.offer);
  const dismiss = useUpsell((s) => s.dismiss);
  const pathname = usePathname();

  // Al navegar a otra página el aviso ya no aplica.
  useEffect(() => {
    dismiss();
  }, [pathname, dismiss]);

  if (!offer) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-4">
      <div
        role="alert"
        className="animate-toast-in pointer-events-auto flex w-full max-w-2xl items-start gap-3 rounded-xl border-2 border-[hsl(var(--accent))] bg-[hsl(var(--card))] p-4 text-[hsl(var(--foreground))] shadow-2xl"
      >
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--accent))] text-lg text-[hsl(var(--accent-foreground))]"
        >
          ✦
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-relaxed">
            Estás agregando <strong>{offer.productName}</strong>. ¿Buscabas la agenda más
            reciente? Ya está disponible <strong>{offer.name}</strong>.
          </p>
          <Link
            href={offer.href}
            onClick={dismiss}
            className="mt-2 inline-flex items-center gap-1 rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-[hsl(var(--primary-foreground))] transition-opacity hover:opacity-90"
          >
            Ver la agenda 2027 →
          </Link>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Cerrar aviso"
          className="shrink-0 rounded-md px-2 py-1 text-lg leading-none text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
        >
          ×
        </button>
      </div>
    </div>
  );
}
