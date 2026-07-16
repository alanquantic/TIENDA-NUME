import { listCategories, listProducts, type CatalogCard } from '@/lib/queries';
import { ProductCard } from '@/components/product-card';

export const dynamic = 'force-dynamic';

type Group = { slug: string; name: string; items: CatalogCard[] };

// Orden de las secciones del home (por slug de categoría). Las categorías
// no listadas aquí se muestran después, y "Otros" (sin categoría) al final.
const SECTION_ORDER = [
  'agenda-numerologica',
  'cursos-de-numerologia',
  'libro',
  'reportes-numerologicos',
  'membresias',
  'licencias',
  'certificaciones',
];

export default async function HomePage() {
  const [products, categories] = await Promise.all([listProducts(), listCategories()]);

  // Agrupa productos por categoría.
  const groups = new Map<string, Group>();
  const uncategorized: CatalogCard[] = [];
  for (const p of products) {
    if (p.categorySlug && p.categoryName) {
      const g = groups.get(p.categorySlug) ?? { slug: p.categorySlug, name: p.categoryName, items: [] };
      g.items.push(p);
      groups.set(p.categorySlug, g);
    } else {
      uncategorized.push(p);
    }
  }

  // Ordena las secciones según SECTION_ORDER; el resto va después; "Otros" al final.
  const ordered: Group[] = [];
  const placed = new Set<string>();
  for (const slug of SECTION_ORDER) {
    const g = groups.get(slug);
    if (g) {
      ordered.push(g);
      placed.add(slug);
    }
  }
  for (const c of categories) {
    if (groups.has(c.slug) && !placed.has(c.slug)) {
      ordered.push(groups.get(c.slug)!);
      placed.add(c.slug);
    }
  }
  if (uncategorized.length) ordered.push({ slug: 'otros', name: 'Otros', items: uncategorized });

  return (
    <div className="w-full px-4 sm:px-6 py-6">
      <div className="flex flex-col md:flex-row gap-6 lg:gap-8">
        {/* Sidebar de categorías */}
        <aside className="md:w-56 md:shrink-0">
          <div className="md:sticky md:top-20">
            <h2 className="px-1 mb-2 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              Categorías
            </h2>
            <nav className="flex md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0">
              {ordered.map((g) => (
                <a
                  key={g.slug}
                  href={`#cat-${g.slug}`}
                  className="flex shrink-0 items-center justify-between gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm hover:bg-[hsl(var(--muted))] transition-colors"
                >
                  <span>{g.name}</span>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">{g.items.length}</span>
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Secciones de productos por categoría */}
        <div className="min-w-0 flex-1">
          {ordered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[hsl(var(--border))] p-12 text-center text-[hsl(var(--muted-foreground))]">
              No hay productos todavía.
            </div>
          ) : (
            <div className="space-y-12">
              {ordered.map((g) => (
                <section key={g.slug} id={`cat-${g.slug}`} className="scroll-mt-24">
                  <div className="mb-4 flex items-center justify-between border-b border-[hsl(var(--border))] pb-2">
                    <h2 className="flex items-center gap-2.5 text-xl font-semibold tracking-tight">
                      <span className="inline-block h-5 w-1.5 rounded-full bg-[hsl(var(--accent))]" />
                      {g.name}
                    </h2>
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">
                      {g.items.length} producto{g.items.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {g.items.map((p) => (
                      <ProductCard key={p.id} product={p} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
