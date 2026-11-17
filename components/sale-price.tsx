import { formatDecimal } from '@/lib/money';

/** Etiqueta "Oferta" (con % de descuento si se conoce). Usa los tokens del tema. */
export function SaleBadge({ percent, className = '' }: { percent?: number | null; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-[hsl(var(--accent))] px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-[hsl(var(--accent-foreground))] shadow-sm ${className}`}
    >
      Oferta{percent ? ` -${percent}%` : ''}
    </span>
  );
}

/** Precio vigente y, si hay oferta, el regular tachado al lado. */
export function PriceWithSale({
  priceAmount,
  regularPriceAmount,
  currency,
  className = '',
  shippingExtra = false,
}: {
  priceAmount: string;
  regularPriceAmount: string | null;
  currency: string;
  className?: string;
  shippingExtra?: boolean;
}) {
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 ${className}`}>
      <span className="text-[hsl(var(--primary))]">{formatDecimal(priceAmount, currency)}</span>
      {regularPriceAmount && (
        <s className="text-[0.8em] font-normal text-[hsl(var(--muted-foreground))]">
          <span className="sr-only">Antes </span>
          {formatDecimal(regularPriceAmount, currency)}
        </s>
      )}
      {shippingExtra && (
        <span className="text-[0.75em] font-medium text-[hsl(var(--muted-foreground))]">+ envío</span>
      )}
    </span>
  );
}

/**
 * "La oferta termina el 17 de noviembre" para mostrar bajo el precio de una
 * oferta con fin. El fin es exclusivo, así que se muestra el último día en que
 * la oferta sigue vigente: si termina a las 00:00 del 18, el texto dice 17.
 */
export function formatSaleEnd(iso: string | null): string | null {
  if (!iso) return null;
  const end = new Date(iso);
  if (Number.isNaN(end.getTime())) return null;
  const date = new Date(end.getTime() - 1);
  return `La oferta termina el ${new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Mexico_City',
  }).format(date)}`;
}
