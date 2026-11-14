import type { MetadataRoute } from 'next';
import { config } from '@/lib/config';
import { absoluteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  const appUrl = config.appUrl;
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Páginas privadas o de proceso de compra: no aportan a buscadores.
        disallow: ['/admin', '/api/', '/carrito', '/checkout', '/cuenta'],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml', appUrl),
    host: appUrl.replace(/\/+$/, ''),
  };
}
