'use client';

import Link from 'next/link';
import { useState } from 'react';
import { track } from '@/lib/analytics';
import { useCart } from '@/lib/cart-store';
import { toMinor } from '@/lib/money';
import { planSymbol, type PlanPeriod } from '@/lib/numerathum-plans';
import type { NumerathumPlan } from '@/lib/queries';

const money = (amount: string | number, currency = 'MXN') => new Intl.NumberFormat('es-MX', {
  style: 'currency', currency, maximumFractionDigits: 0,
}).format(Number(amount));

const PERIOD_MONTHS: Record<PlanPeriod, string> = { monthly: '1 mes', annual: '12 meses' };

export function NumerathumPlans({ plans }: { plans: NumerathumPlan[] }) {
  const add = useCart((s) => s.add);
  const [period, setPeriod] = useState<PlanPeriod>('annual');
  const hasMonthly = plans.some((plan) => plan.options.monthly);
  const annualOnly = plans.filter((plan) => !plan.options.monthly && plan.options.annual);
  const highlighted = plans.find((plan) => plan.slug.includes('horizonte'))?.id;

  function addPlan(plan: NumerathumPlan, chosen: PlanPeriod) {
    const option = plan.options[chosen];
    if (!option) return;
    add({
      variantId: option.variantId,
      productId: plan.id,
      slug: plan.slug,
      name: plan.name,
      variantName: option.name,
      priceAmount: option.priceAmount,
      currency: plan.currency,
      image: plan.image,
      type: 'digital',
      maxStock: null,
      maxPerOrder: plan.maxPerOrder,
    });
    const price = parseFloat(option.priceAmount) || 0;
    track('add_to_cart', {
      currency: plan.currency,
      value: price,
      items: [{
        item_id: option.variantId,
        item_name: plan.name,
        item_variant: option.name,
        item_category: 'digital',
        price,
        quantity: 1,
        currency: plan.currency,
      }],
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex rounded-full border border-primary/20 bg-primary-soft px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Numerathum · Planes</span>
        <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">Un plan para cada<br /><span className="text-primary">momento de tu camino.</span></h1>
        <p className="mt-5 text-lg text-muted-foreground">Elige tu plan y la vigencia que prefieras. Un solo pago, a tu ritmo.</p>
        {hasMonthly && (
          <div role="group" aria-label="Vigencia de los planes" className="mt-8 inline-flex rounded-full border border-border bg-muted p-1.5">
            {(['monthly', 'annual'] as const).map((value) => (
              <button key={value} type="button" aria-pressed={period === value} onClick={() => setPeriod(value)} className={`rounded-full px-5 py-3 text-sm font-semibold transition ${period === value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-primary'}`}>
                {value === 'monthly' ? 'Mensual' : 'Anual · ahorra más'}
              </button>
            ))}
          </div>
        )}
        <p className="mt-3 text-sm text-muted-foreground">Pago único. Tú decides cuándo renovar.</p>
      </div>

      {plans.length === 0 ? (
        <p className="mt-12 rounded-3xl border border-dashed border-border p-12 text-center text-muted-foreground">
          Por ahora no hay planes disponibles.
        </p>
      ) : (
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {plans.map((plan) => {
            const { monthly, annual } = plan.options;
            // Si el plan no tiene la vigencia elegida, se muestra la que sí tiene.
            const chosen: PlanPeriod = plan.options[period] ? period : monthly ? 'monthly' : 'annual';
            const option = plan.options[chosen]!;
            const saving = monthly && annual ? (toMinor(monthly.priceAmount) * 12 - toMinor(annual.priceAmount)) / 100 : null;
            const featured = plan.id === highlighted;
            return (
              <article key={plan.id} id={plan.slug} className={`relative flex scroll-mt-24 flex-col rounded-3xl border bg-card p-7 sm:p-8 ${featured ? 'border-primary shadow-xl shadow-primary/10' : 'border-border'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-4xl text-primary">{planSymbol(plan.slug)}</span>
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">{monthly && annual ? 'Mensual o anual' : monthly ? 'Exclusivamente mensual' : 'Exclusivamente anual'}</span>
                </div>
                <h2 className="mt-6 text-2xl font-semibold">{plan.name.replace(/^Numerathum\s+/, '')}</h2>
                <div className="mt-6" aria-live="polite" aria-atomic="true">
                  <p>
                    <span className="text-4xl font-semibold tracking-tight">{money(option.priceAmount, plan.currency)}</span>
                    <span className="ml-2 text-sm text-muted-foreground">{plan.currency}</span>
                    {option.regularPriceAmount && <span className="ml-2 text-sm text-muted-foreground line-through">{money(option.regularPriceAmount, plan.currency)}</span>}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">Pago único por {PERIOD_MONTHS[chosen]}</p>
                  <div className="mt-4 min-h-14 text-sm">
                    {saving && saving > 0 && chosen === 'annual' ? (
                      <><p className="font-semibold text-primary">Ahorras {money(saving, plan.currency)} al año</p><p className="mt-1 text-muted-foreground">Frente a 12 compras mensuales.</p></>
                    ) : annual && chosen === 'monthly' ? (
                      <p className="text-muted-foreground">También disponible por {money(annual.priceAmount, plan.currency)} al año.</p>
                    ) : (
                      <p className="text-muted-foreground">Una vigencia de {PERIOD_MONTHS[chosen]} en una sola compra.</p>
                    )}
                  </div>
                </div>
                <ul className="mt-5 space-y-3 border-t border-border pt-5 text-sm text-muted-foreground">
                  <li>✓ Acceso al plan {plan.name.replace(/^Numerathum\s+/, '')}</li>
                  <li>✓ Vigencia de {PERIOD_MONTHS[chosen]}</li>
                  <li>✓ Renovación mediante una nueva compra</li>
                </ul>
                <button type="button" onClick={() => addPlan(plan, chosen)} className={`mt-8 w-full rounded-xl px-4 py-3.5 text-sm font-semibold transition hover:opacity-90 ${featured ? 'bg-primary text-primary-foreground' : 'bg-primary-soft text-primary'}`}>
                  Agregar al carrito
                </button>
                <Link href={`/productos/${plan.slug}`} className="mt-3 text-center text-sm text-muted-foreground underline-offset-4 hover:underline">
                  Ver detalles del plan
                </Link>
              </article>
            );
          })}
        </div>
      )}

      <div className="mt-12 grid gap-6 rounded-3xl bg-muted p-7 sm:grid-cols-2 sm:p-9">
        <div><h2 className="text-lg font-semibold">¿Cómo funciona el pago?</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Pagas una sola vez por el periodo elegido. Para continuar al finalizar tu vigencia, vuelves a comprar tu plan.</p></div>
        {annualOnly.map((plan) => (
          <div key={plan.id}><h2 className="text-lg font-semibold">¿{plan.name.replace(/^Numerathum\s+/, '')} tiene opción mensual?</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{plan.name.replace(/^Numerathum\s+/, '')} está disponible exclusivamente con vigencia anual, por {money(plan.options.annual!.priceAmount, plan.currency)} {plan.currency}.</p></div>
        ))}
      </div>
    </div>
  );
}
