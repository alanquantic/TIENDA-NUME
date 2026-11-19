import { listPublishedCatalog } from '@/lib/catalog-data';
import { config } from '@/lib/config';
import { buildMetaCatalogItems, renderMetaCatalogRss } from '@/lib/meta-catalog';

/**
 * Catálogo de productos para Meta Commerce Manager (feed programado).
 * URL: /feeds/meta-catalog.xml — Meta lo descarga cada hora; se regenera cada
 * hora para que precios y ofertas (sale_price) coincidan con la ficha.
 */
// Dinámico + caché de CDN de 1 h: si la BD falla, el 503 no se queda en caché.
export const dynamic = 'force-dynamic';

export async function GET() {
  const appUrl = config.appUrl;
  try {
    const catalog = await listPublishedCatalog();
    const items = buildMetaCatalogItems(catalog, { appUrl });
    return new Response(renderMetaCatalogRss(items, { appUrl }), {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('[meta-catalog] no se pudo generar el feed', error);
    // Un 503 hace que Meta reintente en vez de vaciar el catálogo.
    return new Response('Catálogo no disponible temporalmente', {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Retry-After': '600' },
    });
  }
}
