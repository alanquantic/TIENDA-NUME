'use client';

import { useState } from 'react';

const plans = [
  { id: 'espejo', name: 'Espejo', monthly: 149, annual: 1099, symbol: '◒' },
  { id: 'horizonte', name: 'Horizonte 60', monthly: 189, annual: 1599, symbol: '☼' },
  { id: 'oraculo', name: 'Oráculo 365', monthly: null, annual: 1899, symbol: '✧' },
] as const;

const money = (amount: number) => new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
}).format(amount);

export function NumerathumPlans() {
  const [period, setPeriod] = useState<'monthly' | 'annual'>('annual');
  const [selection, setSelection] = useState<{ name: string; annual: boolean; price: number } | null>(null);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex rounded-full border border-primary/20 bg-primary-soft px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Numerathum · Planes</span>
        <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">Un plan para cada<br /><span className="text-primary">momento de tu camino.</span></h1>
        <p className="mt-5 text-lg text-muted-foreground">Elige Espejo, Horizonte 60 u Oráculo 365 y la vigencia que prefieras. Un solo pago, a tu ritmo.</p>
        <div role="group" aria-label="Vigencia de los planes" className="mt-8 inline-flex rounded-full border border-border bg-muted p-1.5">
          {(['monthly', 'annual'] as const).map((value) => (
            <button key={value} type="button" aria-pressed={period === value} onClick={() => setPeriod(value)} className={`rounded-full px-5 py-3 text-sm font-semibold transition ${period === value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-primary'}`}>
              {value === 'monthly' ? 'Mensual' : 'Anual · ahorra más'}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Pago único. Tú decides cuándo renovar.</p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const annual = period === 'annual' || plan.monthly === null;
          const price = annual ? plan.annual : plan.monthly!;
          const saving = plan.monthly ? plan.monthly * 12 - plan.annual : null;
          return (
            <article key={plan.id} id={plan.id} className={`relative flex scroll-mt-24 flex-col rounded-3xl border bg-card p-7 sm:p-8 ${plan.id === 'horizonte' ? 'border-primary shadow-xl shadow-primary/10' : 'border-border'}`}>
              <div className="flex items-center justify-between gap-2">
                <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-4xl text-primary">{plan.symbol}</span>
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">{plan.monthly === null ? 'Exclusivamente anual' : 'Mensual o anual'}</span>
              </div>
              <h2 className="mt-6 text-2xl font-semibold">{plan.name}</h2>
              <div className="mt-6" aria-live="polite" aria-atomic="true">
                <p><span className="text-4xl font-semibold tracking-tight">{money(price)}</span><span className="ml-2 text-sm text-muted-foreground">MXN</span></p>
                <p className="mt-2 text-sm text-muted-foreground">Pago único por {annual ? '12 meses' : '1 mes'}</p>
                <div className="mt-4 min-h-14 text-sm">
                  {saving && annual ? <><p className="font-semibold text-primary">Ahorras {money(saving)} al año</p><p className="mt-1 text-muted-foreground">Frente a 12 compras mensuales.</p></> : plan.monthly ? <p className="text-muted-foreground">También disponible por {money(plan.annual)} al año.</p> : <p className="text-muted-foreground">Una vigencia de 12 meses en una sola compra.</p>}
                </div>
              </div>
              <ul className="mt-5 space-y-3 border-t border-border pt-5 text-sm text-muted-foreground">
                <li>✓ Acceso al plan {plan.name}</li>
                <li>✓ Vigencia de {annual ? '12 meses' : '1 mes'}</li>
                <li>✓ Renovación mediante una nueva compra</li>
              </ul>
              <button type="button" onClick={() => setSelection({ name: plan.name, annual, price })} className={`mt-8 w-full rounded-xl px-4 py-3.5 text-sm font-semibold transition hover:opacity-90 ${plan.id === 'horizonte' ? 'bg-primary text-primary-foreground' : 'bg-primary-soft text-primary'}`}>Seleccionar {plan.name}</button>
            </article>
          );
        })}
      </div>

      {selection && <section role="status" aria-live="polite" className="mt-8 rounded-2xl border border-primary/25 bg-primary-soft p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><h2 className="text-lg font-semibold text-primary">Tu selección: {selection.name}</h2><p className="mt-2">{selection.annual ? 'Anual · 12 meses' : 'Mensual · 1 mes'} · {money(selection.price)} MXN · Pago único</p><p className="mt-3 text-sm text-muted-foreground">Vista previa del plan. La compra de estos nuevos planes estará disponible próximamente.</p></div>
          <button type="button" onClick={() => setSelection(null)} className="rounded-lg border border-primary/25 px-3 py-2 text-sm text-primary">Cerrar resumen</button>
        </div>
      </section>}

      <div className="mt-12 grid gap-6 rounded-3xl bg-muted p-7 sm:grid-cols-2 sm:p-9">
        <div><h2 className="text-lg font-semibold">¿Cómo funciona el pago?</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Pagas una sola vez por el periodo elegido. Para continuar al finalizar tu vigencia, vuelves a comprar tu plan.</p></div>
        <div><h2 className="text-lg font-semibold">¿Oráculo 365 tiene opción mensual?</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Oráculo 365 está disponible exclusivamente con vigencia anual, por {money(1899)} MXN.</p></div>
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">Vista previa de los nuevos planes Numerathum.</p>
    </div>
  );
}
