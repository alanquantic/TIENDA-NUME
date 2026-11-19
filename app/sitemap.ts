import type { MetadataRoute } from 'next';
import { listPublishedCatalog } from '@/lib/catalog-data';
import { config } from '@/lib/config';
import { absoluteUrl } from '@/lib/seo';

// Se genera en cada visita del rastreador: los productos nuevos aparecen sin redeploy
// y un fallo momentáneo de la BD no deja el sitemap vacío en caché.
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = config.appUrl;
  const now = new Date();
  let productEntries: MetadataRoute.Sitemap = [];
  try {
    const catalog = await listPublishedCatalog();
    productEntries = catalog.map((product) => ({
      url: absoluteUrl(`/productos/${product.slug}`, appUrl),
      lastModified: product.updatedAt,
      changeFrequency: 'weekly',
      priority: 0.8,
    }));
  } catch (error) {
    console.error('[sitemap] no se pudieron leer los productos', error);
  }

  return [
    { url: absoluteUrl('/', appUrl), lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/planes', appUrl), lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    ...productEntries,
  ];
}
