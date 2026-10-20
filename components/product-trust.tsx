import type { ReactNode } from 'react';

function TrustIcon({ children }: { children: ReactNode }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2 h-7 w-7 text-[hsl(var(--primary))]">{children}</svg>;
}

export function ProductTrust({ type }: {
  type: 'digital' | 'physical';
  paymentMethods: { method: string; label: string }[];
}) {
  return (
    <section aria-label="Compra con confianza" className="mt-6 overflow-hidden rounded-2xl border border-[hsl(var(--primary)/0.12)] bg-[hsl(var(--card))]">
      <div className="grid grid-cols-3 gap-3 bg-[hsl(var(--primary-soft)/0.45)] px-3 py-5 text-center text-xs sm:px-4 sm:text-sm">
        <div>
          <TrustIcon>{type === 'physical' ? <><path d="m3 7 9-4 9 4-9 4-9-4Z" /><path d="M3 7v10l9 4 9-4V7M12 11v10M7 5l10 4" /></> : <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>}</TrustIcon>
          <p className="font-medium">{type === 'physical' ? 'Envíos nacionales' : 'Entrega digital'}</p>
          <p className="mt-1 text-[hsl(var(--muted-foreground))]">{type === 'physical' ? 'Costo al finalizar tu compra' : 'Acceso por correo tras el pago'}</p>
        </div>
        <div>
          <TrustIcon><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></TrustIcon>
          <p className="font-medium">Calidad y confianza</p>
          <p className="mt-1 text-[hsl(var(--muted-foreground))]">Numerología Cotidiana</p>
        </div>
        <div>
          <TrustIcon><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></TrustIcon>
          <p className="font-medium">Pago seguro</p>
          <p className="mt-1 text-[hsl(var(--muted-foreground))]">A través de la pasarela de pago</p>
        </div>
      </div>
        <div className="border-t border-[hsl(var(--primary)/0.1)] px-4 py-4 text-center sm:px-6">
          <p className="flex items-center justify-center gap-1.5 text-[11px] font-medium tracking-wide text-[hsl(var(--muted-foreground))]">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="h-3.5 w-3.5"><rect x="6" y="10" width="12" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
            Pago seguro con
          </p>
          <div className="mx-auto mt-3 flex max-w-xs items-center justify-center gap-3 sm:gap-8">
            <span aria-label="Mercado Pago" className="inline-flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 text-[#003087]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/payments/mercadopago.svg" alt="" width={38} height={38} className="h-9 w-9 shrink-0 object-contain" />
              <span aria-hidden="true" className="text-left text-base font-bold leading-[0.95] tracking-tight">mercado<br />pago</span>
            </span>
            <span aria-hidden="true" className="h-7 w-px shrink-0 bg-[hsl(var(--border))]" />
            <span aria-label="PayPal" className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2 py-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/payments/paypal.svg" alt="" width={24} height={30} className="h-7 w-6 shrink-0 object-contain" />
              <span aria-hidden="true" className="text-lg font-bold italic tracking-tight"><span className="text-[#003087]">Pay</span><span className="text-[#0070E0]">Pal</span></span>
            </span>
          </div>
        </div>
    </section>
  );
}
