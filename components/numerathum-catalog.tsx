import Link from 'next/link';

const plans = [
  { id: 'espejo', name: 'Espejo', price: '149.00', symbol: '◒', background: 'linear-gradient(135deg, #966e90, #693061)' },
  { id: 'horizonte', name: 'Horizonte 60', price: '189.00', symbol: '☼', background: 'linear-gradient(135deg, #c28c68, #764360)' },
  { id: 'oraculo', name: 'Oráculo 365', price: '1,899.00', symbol: '✧', background: 'linear-gradient(135deg, #626c9b, #392e64)' },
];

export function NumerathumCatalog() {
  return (
    <section id="cat-planes-numerathum" className="scroll-mt-24">
      <div className="mb-4 flex items-center justify-between border-b border-border pb-2">
        <h2 className="flex items-center gap-2.5 text-xl font-semibold tracking-tight"><span className="inline-block h-5 w-1.5 rounded-full bg-accent" />Planes Numerathum</h2>
        <span className="text-sm text-muted-foreground">3 productos</span>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {plans.map((plan) => (
          <article key={plan.id} className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md">
            <Link href={`/planes#${plan.id}`} aria-label={`Ver plan ${plan.name}`} className="block">
              <div style={{ background: plan.background }} className="relative flex aspect-square flex-col justify-between overflow-hidden p-5 text-white">
                <span className="text-[10px] font-medium uppercase tracking-[0.25em]">Numerathum</span>
                <span aria-hidden="true" className="absolute -right-3 top-5 text-[140px] leading-none text-white/15 transition-transform group-hover:scale-110">{plan.symbol}</span>
                <div className="relative"><p className="text-xs uppercase tracking-widest text-white/80">Plan</p><p className="mt-1 text-2xl font-semibold leading-tight">{plan.name}</p><p className="mt-3 text-xs text-white/80">{plan.id === 'oraculo' ? 'Acceso anual' : 'Mensual · Anual'}</p></div>
              </div>
            </Link>
            <div className="flex flex-1 flex-col p-3 sm:p-4">
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Digital</p>
              <Link href={`/planes#${plan.id}`} className="font-medium leading-tight hover:underline">Numerathum {plan.name}</Link>
              <p className="mt-2 font-semibold text-primary">{plan.id !== 'oraculo' && <span className="mr-1 text-xs font-normal text-muted-foreground">Desde</span>}${plan.price}</p>
              <Link href={`/planes#${plan.id}`} className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">{plan.id === 'oraculo' ? 'Ver plan' : 'Elegir opción'}</Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
