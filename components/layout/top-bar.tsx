import Universal from '@/lib/numerology';

type CollectiveEnergy = {
  id: string;
  label: string;
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
      value: universal.calcUniversalDay(params),
      valueClassName: 'text-[hsl(var(--accent))]',
    },
    {
      id: 'semana',
      label: 'Sem',
      value: universal.calcCurrentUniversalWeek(params),
      valueClassName: 'text-[hsl(var(--primary))]',
    },
    {
      id: 'mes',
      label: 'Mes',
      value: universal.calcUniversalMonth(params),
      valueClassName: 'text-[hsl(var(--fuchsia))]',
    },
  ];
}

export function TopBar() {
  const collectiveEnergy = getCollectiveEnergy();

  return (
    <div className="bg-gradient-brand text-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 py-3 text-center sm:flex-row sm:justify-between sm:gap-4 sm:px-6 sm:py-2 sm:text-left">
        <h2 className="text-2xl font-medium tracking-wide text-white/85 sm:text-3xl">
          Energía Colectiva
        </h2>

        <div className="flex items-center gap-2 sm:gap-3">
          {collectiveEnergy.map((energy) => (
            <div key={energy.id} className="flex flex-col items-center">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white font-display text-base font-semibold ring-1 ring-white/40 shadow-[0_8px_18px_hsl(var(--foreground)/0.14)]">
                <span className={energy.valueClassName}>{energy.value}</span>
              </span>
              <span className="mt-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-white/70">
                {energy.label}
              </span>
            </div>
          ))}
        </div>

        <h2 className="text-2xl font-medium text-white/85 sm:text-3xl">{formatToday()}</h2>
      </div>
    </div>
  );
}
