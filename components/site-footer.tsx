import { config } from '@/lib/config';
import { sectionHref } from '@/lib/catalog-sections';
import { NUME_SITE_URL } from '@/lib/nume-site';
import { listFooterSections } from '@/lib/queries';
import { SITE_BRAND, SITE_DESCRIPTION, SITE_LOGO_URL, SITE_TITLE } from '@/lib/site';
import { SOCIAL_PROFILE_URLS, SocialLinks } from '@/components/ui/social-links';

type FooterLink = { label: string; href: string; external?: boolean };

const NUME_LINKS: readonly FooterLink[] = [
  { label: 'Numerología Cotidiana', href: NUME_SITE_URL, external: true },
  { label: 'Numerathum', href: 'https://numerathum.numerologia-cotidiana.com', external: true },
  { label: 'Blog', href: `${NUME_SITE_URL}/blog`, external: true },
  { label: 'Horóscopos', href: 'https://www.numerologia-cotidiana.com/horoscopo-personal-2027/', external: true },
  { label: 'Directorio', href: `${NUME_SITE_URL}/directorio`, external: true },
];

const HELP_LINKS: readonly FooterLink[] = [
  { label: 'Mi cuenta', href: '/cuenta' },
  { label: 'Carrito', href: '/carrito' },
  {
    label: 'Términos y condiciones',
    href: 'https://www.numerologia-cotidiana.com/paginas/aviso-de-privacidad/',
    external: true,
  },
];

/** Organization + WebSite para que los buscadores asocien la tienda con la marca. */
function structuredData(): string {
  const url = config.appUrl.replace(/\/+$/, '');
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${url}/#organization`,
        name: SITE_BRAND,
        url,
        logo: SITE_LOGO_URL,
        sameAs: SOCIAL_PROFILE_URLS,
      },
      {
        '@type': 'WebSite',
        '@id': `${url}/#website`,
        name: SITE_TITLE,
        description: SITE_DESCRIPTION,
        url,
        inLanguage: 'es-MX',
        publisher: { '@id': `${url}/#organization` },
      },
    ],
  };
  // "<" escapado: el JSON nunca puede cerrar el <script> que lo contiene.
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

async function footerSections() {
  try {
    return await listFooterSections();
  } catch (err) {
    // Sin BD el footer sigue saliendo, solo sin categorías.
    console.error('[footer] no se pudieron leer las categorías', err);
    return [];
  }
}

function LinkList({ links }: { links: readonly FooterLink[] }) {
  return (
    <ul className="space-y-2">
      {links.map((link) => (
        <li key={link.href}>
          <a
            href={link.href}
            {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="text-white/75 underline-offset-4 transition-colors hover:text-white hover:underline"
          >
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

const headingClass = 'mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/60';

export async function SiteFooter() {
  const sections = await footerSections();

  return (
    <footer className="mt-16 bg-navbar text-sm text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className="space-y-4">
          <a href="/" className="inline-block" aria-label={`${SITE_BRAND} – inicio de la tienda`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/logo-numerologia-cotidiana-blanco.png"
              alt={SITE_BRAND}
              width={165}
              height={40}
              loading="lazy"
              className="h-10 w-auto"
            />
          </a>
          <p className="font-display text-base font-semibold leading-snug text-white">{SITE_TITLE}</p>
          <p className="max-w-sm leading-relaxed text-white/75">{SITE_DESCRIPTION}</p>
          <SocialLinks
            className="flex items-center gap-2 pt-1"
            itemClassName="header-chip flex h-9 w-9 items-center justify-center rounded-full border border-white/40 text-white hover:bg-white/15"
            iconSize={16}
          />
        </div>

        {sections.length > 0 && (
          <nav aria-label="Categorías de la tienda">
            <h2 className={headingClass}>Categorías</h2>
            <LinkList links={sections.map((s) => ({ label: s.name, href: sectionHref(s.slug) }))} />
          </nav>
        )}

        <nav aria-label="Numerología Cotidiana">
          <h2 className={headingClass}>Numerología Cotidiana</h2>
          <LinkList links={NUME_LINKS} />
        </nav>

        <nav aria-label="Ayuda">
          <h2 className={headingClass}>Tu compra</h2>
          <LinkList links={HELP_LINKS} />
        </nav>
      </div>

      <div className="border-t border-white/15">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-white/65 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © {new Date().getFullYear()} {SITE_BRAND} · Laura L. Rodríguez. Todos los derechos reservados.
          </p>
          <p>Productos digitales y físicos</p>
        </div>
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData() }} />
    </footer>
  );
}
