// Secciones del home a partir del catálogo. Las usan el home y el footer, así
// los enlaces del footer (/#cat-<slug>) siempre apuntan a una sección que existe.
import type { CatalogCard } from './queries';

export type CatalogSection = { slug: string; name: string; items: CatalogCard[] };

// Orden de las secciones del home (por slug de categoría). Las categorías
// no listadas aquí se muestran después, y "Otros" (sin categoría) al final.
const SECTION_ORDER = [
  'planes-numerathum',
  'agenda-numerologica',
  'cursos-de-numerologia',
  'libro',
  'reportes-numerologicos',
  'membresias',
  'licencias',
  'certificaciones',
];

// Sección destacada al inicio del home: todo producto activo con "2027" en su
// slug (agendas, preventas y lo que se agregue de esa colección). Esos
// productos ya no se repiten en su categoría.
const FEATURED = { slug: 'coleccion-2027', name: 'Colección 2027', match: /2027/ };

export function groupCatalogSections(
  products: CatalogCard[],
  categories: { slug: string }[],
): CatalogSection[] {
  // Agrupa productos por categoría.
  const groups = new Map<string, CatalogSection>();
  const uncategorized: CatalogCard[] = [];
  const featured: CatalogCard[] = [];
  for (const p of products) {
    if (FEATURED.match.test(p.slug)) {
      featured.push(p);
    } else if (p.categorySlug && p.categoryName) {
      const g = groups.get(p.categorySlug) ?? { slug: p.categorySlug, name: p.categoryName, items: [] };
      g.items.push(p);
      groups.set(p.categorySlug, g);
    } else {
      uncategorized.push(p);
    }
  }

  // Ordena las secciones según SECTION_ORDER; el resto va después; "Otros" al final.
  const ordered: CatalogSection[] = [];
  if (featured.length) {
    ordered.push({ slug: FEATURED.slug, name: FEATURED.name, items: featured });
  }
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
  return ordered;
}

/** Ancla de la sección en el home. */
export function sectionHref(slug: string): string {
  return `/#cat-${slug}`;
}
