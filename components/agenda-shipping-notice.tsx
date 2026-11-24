import { AGENDA_2026_PRODUCT_ID, AGENDA_2027_PRODUCT_ID } from '@/lib/order-limits';

export function hasAgendaShippingNotice(productId: string) {
  return productId === AGENDA_2026_PRODUCT_ID || productId === AGENDA_2027_PRODUCT_ID;
}

export function AgendaShippingNotice() {
  return (
    <p className="rounded-lg border border-[hsl(var(--primary)/0.2)] bg-[hsl(var(--primary-soft))] px-4 py-3 text-base font-semibold text-[hsl(var(--primary))]">
      Los envíos de las agendas se realizarán a partir de la primera semana de diciembre.
    </p>
  );
}
