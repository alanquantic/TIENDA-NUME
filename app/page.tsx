import { getAgendaUpsellTarget, listCategories, listProducts } from '@/lib/queries';
import { groupCatalogSections } from '@/lib/catalog-sections';
import { ListingTracker } from '@/components/analytics/listing-tracker';
import { catalogCardToGaItem } from '@/lib/analytics';
import { ProductCard } from '@/components/product-card';
import { NumerathumCatalog } from '@/components/numerathum-catalog';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [products, categories, upsell] = await Promise.all([
    listProducts(),
    listCategories(),
    getAgendaUpsellTarget(),
  ]);

  const ordered = groupCatalogSections(products, categories);

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
              <a href="#cat-planes-numerathum" className="flex shrink-0 items-center justify-between gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"><span>Planes Numerathum</span><span className="text-xs text-muted-foreground">3</span></a>
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
          <div className="mb-12"><NumerathumCatalog /></div>
          {ordered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[hsl(var(--border))] p-12 text-center text-[hsl(var(--muted-foreground))]">
              No hay productos todavía.
            </div>
          ) : (
            <div className="space-y-12">
              {ordered.map((g) => (
                <section key={g.slug} id={`cat-${g.slug}`} className="scroll-mt-24">
                  <ListingTracker
                    listId={`cat_${g.slug}`}
                    listName={g.name}
                    items={g.items.map((p, index) =>
                      catalogCardToGaItem(p, {
                        list_id: `cat_${g.slug}`,
                        list_name: g.name,
                        index
                      })
                    )}
                  />
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
                    {g.items.map((p, index) => (
                      <ProductCard
                        key={p.id}
                        product={p}
                        listId={`cat_${g.slug}`}
                        listName={g.name}
                        index={index}
                        upsell={upsell}
                      />
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
