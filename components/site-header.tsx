import { ChevronDownIcon, MenuIcon, SearchIcon } from '@/components/ui/icons';
import { SocialLinks } from '@/components/ui/social-links';
import { ThemeToggle } from '@/components/theme-toggle';
import { CartButton } from '@/components/cart-button';

// Sitio de nume (WEB-NUME). Cambia esta base si el dominio de producción difiere.
const NUME = 'https://web-nume.vercel.app';

type NavItem = {
  label: string;
  href: string;
  children?: readonly NavItem[];
};

const NAV_ITEMS: readonly NavItem[] = [
  {
    label: 'Numerología',
    href: `${NUME}/numerologia`,
    children: [
      { label: 'Mi Mapa Numerológico', href: `${NUME}/mi-mapa` },
      { label: 'Explora por número', href: `${NUME}/explora` },
      { label: 'Mi carta', href: `${NUME}/mi-carta` },
      { label: 'Numerología de Pareja', href: `${NUME}/numerologia-de-pareja` },
      {
        label: 'Vibraciones de Tiempo',
        href: `${NUME}/vibraciondeltiempo`,
        children: [
          { label: 'La Brújula Numerológica', href: `${NUME}/labrujulanumerologica` },
          { label: 'Etapa Personal', href: `${NUME}/etapapersonal` },
          { label: 'Año Personal', href: `${NUME}/anopersonal` },
          { label: 'Mes Personal', href: `${NUME}/mespersonal` },
          { label: 'Semana Personal', href: `${NUME}/semanapersonal` },
          { label: 'Día Personal', href: `${NUME}/diapersonal` },
          { label: 'Vibraciones Colectivas', href: `${NUME}/vibracionescolectivas` },
        ],
      },
      {
        label: 'Calcula tu Pináculo',
        href: `${NUME}/calculatupinaculo`,
        children: [{ label: 'Significado de los Números', href: `${NUME}/significadodelosnumeros` }],
      },
      {
        label: 'Numerología Nombre',
        href: `${NUME}/numerologianombre`,
        children: [
          { label: 'Número del Nombre', href: `${NUME}/numerodelnombre` },
          { label: 'Número del Alma', href: `${NUME}/numerodelalma` },
          { label: 'Número de Expresión del Alma', href: `${NUME}/numerodeexpresiondelalma` },
          { label: 'Número de la Madurez', href: `${NUME}/numerodelamadurez` },
          { label: 'Significado de Letras', href: `${NUME}/significadodeletras` },
          { label: 'Nombre Activo', href: `${NUME}/nombreactivo` },
          { label: 'Nombre Hereditario', href: `${NUME}/nombrehereditario` },
        ],
      },
    ],
  },
  { label: 'Tienda', href: '/' },
  { label: 'Blog', href: `${NUME}/blog` },
  {
    label: 'Horóscopos',
    href: `${NUME}/horoscopos`,
    children: [{ label: 'Revisa tu horóscopo mensual 2026', href: `${NUME}/revisatuhoroscopomensual2026` }],
  },
  {
    label: 'Directorio',
    href: `${NUME}/directorio`,
    children: [
      { label: 'Consultores', href: `${NUME}/consultores` },
      { label: 'Instructores', href: `${NUME}/instructores` },
      { label: 'Cursos', href: `${NUME}/cursos` },
    ],
  },
];

function renderDesktopLeaf(item: NavItem, level: number) {
  if (level === 0) {
    return (
      <a href={item.href} className="header-link-float flex items-center gap-1 text-foreground/82 hover:text-primary">
        <span className="relative z-10">{item.label}</span>
      </a>
    );
  }
  return (
    <a
      href={item.href}
      className="header-chip flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm text-foreground/80 hover:bg-primary-soft hover:text-primary"
    >
      <span className="relative z-10">{item.label}</span>
    </a>
  );
}

function renderDesktopBranch(item: NavItem, level: number) {
  const isTopLevel = level === 0;
  const wrapperClass = isTopLevel ? 'group relative' : 'group/nested relative';
  const triggerClass = isTopLevel
    ? 'header-link-float flex items-center gap-1 py-3 text-foreground/82 hover:text-primary'
    : 'header-chip flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm text-foreground/80 hover:bg-primary-soft hover:text-primary';
  const panelShellClass = isTopLevel
    ? 'invisible absolute left-0 top-full z-50 min-w-[19rem] pt-2 opacity-0 transition duration-200 group-hover:visible group-hover:opacity-100'
    : 'invisible absolute left-full top-0 z-50 min-w-[19rem] pl-2 opacity-0 transition duration-200 group-hover/nested:visible group-hover/nested:opacity-100';
  const panelClass = 'header-panel rounded-3xl border border-border/80 bg-card/95 p-3 shadow-2xl shadow-black/10 backdrop-blur';

  return (
    <div key={`${level}-${item.label}`} className={wrapperClass}>
      <a href={item.href} className={triggerClass}>
        <span className="relative z-10">{item.label}</span>
        <ChevronDownIcon
          width={14}
          height={14}
          className={isTopLevel ? 'transition duration-200 group-hover:translate-y-[1px]' : '-rotate-90 transition duration-200 group-hover/nested:translate-x-[1px]'}
        />
      </a>

      <div className={panelShellClass}>
        <div className={panelClass}>
          <div className="space-y-1">{renderDesktopNav(item.children ?? [], level + 1)}</div>
        </div>
      </div>
    </div>
  );
}

function renderDesktopNav(items: readonly NavItem[], level = 0) {
  return items.map((item) => {
    if (item.children?.length) {
      return renderDesktopBranch(item, level);
    }
    return (
      <div key={`${level}-${item.label}`} className={level === 0 ? '' : 'relative'}>
        {renderDesktopLeaf(item, level)}
      </div>
    );
  });
}

function MobileMenuItem({ item, level }: { item: NavItem; level: number }) {
  if (item.children?.length) {
    return (
      <details className="group header-panel rounded-3xl border border-border bg-background/70">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-foreground transition hover:text-primary">
          <span>{item.label}</span>
          <ChevronDownIcon width={16} height={16} className="transition duration-200 group-open:rotate-180" />
        </summary>
        <div className="space-y-2 px-3 pb-3">
          <a href={item.href} className="header-chip block rounded-2xl px-4 py-2 text-sm text-foreground/65 hover:bg-primary-soft hover:text-primary">
            <span className="relative z-10">Ver todo</span>
          </a>
          {item.children.map((child) => (
            <div key={`${level}-${item.label}-${child.label}`} className={level > 0 ? 'pl-3' : ''}>
              <MobileMenuItem item={child} level={level + 1} />
            </div>
          ))}
        </div>
      </details>
    );
  }

  return (
    <a href={item.href} className="header-chip block rounded-2xl px-4 py-3 text-sm font-medium text-foreground/85 hover:bg-primary-soft hover:text-primary">
      <span className="relative z-10">{item.label}</span>
    </a>
  );
}

function Brand() {
  return (
    <a href="/" className="header-link-float group flex items-center justify-center gap-2 font-display text-xl font-semibold">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${NUME}/images/logo_favicon.png`} alt="" className="h-9 w-9" />
      <span className="leading-tight">
        <span className="block text-gradient-brand">numerologia</span>
        <span className="block text-xs font-medium text-foreground/60">cotidiana</span>
      </span>
    </a>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/70 backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-card/60">
      <div className="mx-auto hidden max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-6 py-2 md:grid">
        <nav className="hidden items-center gap-5 text-sm font-medium md:flex">{renderDesktopNav(NAV_ITEMS)}</nav>

        <Brand />

        <div className="flex items-center justify-end gap-4">
          <span className="hidden text-sm italic text-foreground/70 lg:inline">de Laura L. Rodríguez</span>
          <SocialLinks
            className="hidden items-center gap-1.5 xl:flex"
            itemClassName="header-chip flex h-9 w-9 items-center justify-center rounded-full border border-border text-primary hover:bg-primary-soft"
            iconSize={16}
          />
          <ThemeToggle className="header-chip flex h-9 w-9 items-center justify-center rounded-full border border-border text-primary hover:bg-primary-soft" />
          <a
            href="/"
            aria-label="Buscar"
            className="header-chip flex h-9 w-9 items-center justify-center rounded-full border border-border text-primary hover:bg-primary-soft"
          >
            <SearchIcon width={18} height={18} className="relative z-10" />
          </a>
          <CartButton />
        </div>
      </div>

      <details className="group md:hidden">
        <summary className="mx-auto grid max-w-7xl list-none grid-cols-[44px_1fr_44px] items-center gap-3 px-4 py-3">
          <span className="header-chip flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-primary">
            <MenuIcon width={22} height={22} />
          </span>
          <span className="flex justify-center">
            <Brand />
          </span>
          <span className="flex justify-end">
            <CartButton className="header-chip flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-primary" />
          </span>
        </summary>

        <div className="border-t border-border bg-card/95 px-4 pb-5 pt-3 shadow-lg backdrop-blur">
          <div className="space-y-3">
            {NAV_ITEMS.map((item) => (
              <MobileMenuItem key={`mobile-${item.label}`} item={item} level={0} />
            ))}
            <div className="flex items-center gap-3 pt-2">
              <SocialLinks
                className="flex gap-3"
                itemClassName="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-primary"
              />
              <ThemeToggle className="ml-auto flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-primary" />
            </div>
          </div>
        </div>
      </details>
    </header>
  );
}
