import type { ReactNode } from 'react';

function TrustIcon({ children }: { children: ReactNode }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2 h-7 w-7 text-[hsl(var(--primary))]">{children}</svg>;
}

export function ProductTrust({ type, paymentMethods }: {
  type: 'digital' | 'physical';
  paymentMethods: { method: string; label: string }[];
}) {
  return (
    <section aria-label="Compra con confianza" className="mt-6 space-y-5">
      <div className="grid grid-cols-3 gap-3 border-y border-[hsl(var(--border))] py-5 text-center text-xs sm:text-sm">
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
      {paymentMethods.length > 0 && (
        <div className="rounded-xl border border-[hsl(var(--border))] p-4">
          <p className="text-sm font-medium">Pago seguro con</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {paymentMethods.map(({ method, label }) => (
              <span key={method} className="inline-flex min-h-9 items-center rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 text-sm font-semibold">{label}</span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
