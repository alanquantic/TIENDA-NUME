import Universal from '@/lib/numerology';

// Numerathum explica qué significa cada vibración universal (día, semana y mes).
const UNIVERSAL_URL = 'https://numerathum.numerologia-cotidiana.com/universal';

type CollectiveEnergy = {
  id: string;
  label: string;
  /** Nombre completo para lectores de pantalla ("Sem" → "Semana universal"). */
  title: string;
  value: number;
  valueClassName: string;
};

function formatToday(): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

function getCollectiveEnergy(): readonly CollectiveEnergy[] {
  const today = new Date();
  const universal = new Universal();
  const params = {
    day: today.getDate(),
    month: today.getMonth() + 1,
    year: today.getFullYear(),
  };

  return [
    {
      id: 'dia',
      label: 'Día',
      title: 'Día universal',
      value: universal.calcUniversalDay(params),
      valueClassName: 'text-[hsl(var(--fuchsia))]',
    },
    {
      id: 'semana',
      label: 'Sem',
      title: 'Semana universal',
      value: universal.calcCurrentUniversalWeek(params),
      valueClassName: 'text-[hsl(var(--fuchsia))]',
    },
    {
      id: 'mes',
      label: 'Mes',
      title: 'Mes universal',
      value: universal.calcUniversalMonth(params),
      valueClassName: 'text-[hsl(var(--fuchsia))]',
    },
  ];
}

export function TopBar() {
  const collectiveEnergy = getCollectiveEnergy();

  return (
    <div className="bg-topbar text-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 py-3 text-center sm:flex-row sm:justify-between sm:gap-4 sm:px-6 sm:py-2 sm:text-left">
        <h2 className="text-2xl font-medium tracking-wide text-white/85 sm:text-3xl">
          <a
            href={UNIVERSAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="Ver su significado en Numerathum"
            className="rounded-lg underline-offset-8 outline-none transition-colors hover:text-white hover:underline focus-visible:ring-2 focus-visible:ring-white"
          >
            Energía Colectiva
          </a>
        </h2>

        <div className="flex items-center gap-2 sm:gap-3">
          {collectiveEnergy.map((energy) => (
            <a
              key={energy.id}
              href={UNIVERSAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              title="Ver su significado en Numerathum"
              aria-label={`${energy.title} ${energy.value}: ver su significado en Numerathum`}
              className="group flex flex-col items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white font-display text-base font-semibold ring-2 ring-navbar shadow-[0_3px_6px_rgb(0_0_0/0.35)] transition duration-200 group-hover:-translate-y-0.5 group-hover:scale-110 group-hover:ring-white group-hover:shadow-[0_6px_14px_rgb(0_0_0/0.45)]">
                <span className={energy.valueClassName}>{energy.value}</span>
              </span>
              <span className="mt-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-white/70 transition-colors group-hover:text-white">
                {energy.label}
              </span>
            </a>
          ))}
        </div>

        <h2 className="text-2xl font-medium text-white/85 sm:text-3xl">{formatToday()}</h2>
      </div>
    </div>
  );
}
