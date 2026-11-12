import { SaleCountdown } from '@/components/sale-countdown';

// Fin de las ofertas del Buen Fin 2026: 00:00 del 18 de noviembre en Ciudad de
// México (UTC−6), es decir, el último día completo es el 17. Debe coincidir con
// el `sale_ends_at` cargado en las variantes.
export const BUEN_FIN_ENDS_AT = '2026-11-18T00:00:00-06:00';

/** Banner rojo del catálogo con la cuenta regresiva. Se oculta solo al vencer. */
export function BuenFinBanner() {
  if (Date.now() >= Date.parse(BUEN_FIN_ENDS_AT)) return null;
  return (
    <SaleCountdown
      endsAt={BUEN_FIN_ENDS_AT}
      tone="promo"
      label="Tiempo restante de las ofertas del Buen Fin"
      className="mb-8 flex flex-col items-center justify-between gap-4 rounded-xl bg-[hsl(var(--promo))] px-5 py-4 text-center text-[hsl(var(--promo-foreground))] shadow-sm sm:flex-row sm:px-6 sm:text-left"
    >
      <div>
        <p className="text-xl font-bold tracking-tight sm:text-2xl">¡Aprovecha las ofertas del Buen Fin!</p>
        <p className="mt-1 text-sm font-medium">Descuentos de hasta 40% · Terminan el 17 de noviembre</p>
      </div>
    </SaleCountdown>
  );
}
