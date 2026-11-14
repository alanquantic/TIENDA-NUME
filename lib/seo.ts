// Utilidades de SEO sin dependencias de servidor: URLs absolutas, textos para
// <meta description>, imágenes aptas para buscadores/Meta y datos
// estructurados (schema.org). Las usan la ficha de producto, el sitemap y el
// feed del catálogo de Meta.

import { SITE_BRAND } from './site';
import { effectivePrice, type SaleFields } from './sale-price';

/** Une el origen del sitio con una ruta o devuelve la URL tal cual si ya es absoluta. */
export function absoluteUrl(pathOrUrl: string, appUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = appUrl.replace(/\/+$/, '');
  return `${base}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#039;': "'",
};

/** Texto plano: quita etiquetas HTML, decodifica entidades básicas y colapsa espacios. */
export function plainText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|h[1-6]|div)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? ' ')
    .replace(/[ \t ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

/**
 * Descripción para buscadores (~155 caracteres): el primer párrafo del texto,
 * en una línea y cortado en un límite de palabra con "…".
 */
export function metaDescription(text: string | null | undefined, max = 155): string {
  const plain = plainText(text);
  if (!plain) return '';
  const firstParagraph = plain.split(/\n\s*\n|\n/).find((line) => line.trim().length > 0) ?? plain;
  const oneLine = firstParagraph.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= max) return oneLine;
  const cut = oneLine.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.–—-]+$/, '')}…`;
}

/**
 * Meta y Google no aceptan SVG como imagen de producto. Con esto se descartan
 * para el feed y las etiquetas og:image.
 */
export function isRasterImage(url: string): boolean {
  return !/\.svg(?:$|[?#])/i.test(url);
}

/** Imágenes del producto como URLs absolutas, sin repetir y sin SVG. */
export function shareableImages(images: unknown, appUrl: string): string[] {
  const list = Array.isArray(images) ? images.filter((i): i is string => typeof i === 'string') : [];
  return [...new Set(list.map((image) => absoluteUrl(image.trim(), appUrl)))].filter(
    (image) => image.length > 0 && isRasterImage(image),
  );
}

export type SeoVariant = SaleFields & {
  id: string;
  name: string;
  sku: string | null;
  stock: number;
  trackInventory: boolean;
};

export type SeoProduct = {
  slug: string;
  name: string;
  description: string | null;
  shortDescription: string | null;
  type: 'digital' | 'physical';
  currency: string;
  images: unknown;
  categoryName: string | null;
};

export function variantInStock(type: 'digital' | 'physical', variant: Pick<SeoVariant, 'stock' | 'trackInventory'>): boolean {
  return type === 'digital' || !variant.trackInventory || variant.stock > 0;
}

/** Precio con dos decimales, como lo esperan schema.org y Meta. */
export function formatAmount(amount: string | number): string {
  return Number(amount).toFixed(2);
}

/**
 * JSON-LD `Product` para la ficha (resultados enriquecidos de Google:
 * precio, disponibilidad, imagen). Con varias variantes usa `AggregateOffer`.
 */
export function productJsonLd(
  product: SeoProduct,
  variants: SeoVariant[],
  opts: { appUrl: string; now?: Date },
): Record<string, unknown> {
  const now = opts.now ?? new Date();
  const url = absoluteUrl(`/productos/${product.slug}`, opts.appUrl);
  const base = opts.appUrl.replace(/\/+$/, '');
  const seller = { '@id': `${base}/#organization` };
  const images = shareableImages(product.images, opts.appUrl);
  const priced = variants.map((variant) => ({
    variant,
    price: effectivePrice(variant, now),
    inStock: variantInStock(product.type, variant),
  }));

  const description =
    metaDescription(product.shortDescription, 5000) || metaDescription(product.description, 5000);

  const offerFor = (entry: (typeof priced)[number]) => ({
    '@type': 'Offer',
    url,
    priceCurrency: product.currency,
    price: formatAmount(entry.price.priceAmount),
    availability: entry.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    itemCondition: 'https://schema.org/NewCondition',
    ...(entry.price.onSale && entry.price.saleEndsAt
      ? { priceValidUntil: entry.price.saleEndsAt.slice(0, 10) }
      : {}),
    seller,
  });

  let offers: Record<string, unknown> | undefined;
  if (priced.length === 1) {
    offers = offerFor(priced[0]);
  } else if (priced.length > 1) {
    const amounts = priced.map((entry) => Number(entry.price.priceAmount));
    offers = {
      '@type': 'AggregateOffer',
      priceCurrency: product.currency,
      lowPrice: formatAmount(Math.min(...amounts)),
      highPrice: formatAmount(Math.max(...amounts)),
      offerCount: priced.length,
      availability: priced.some((entry) => entry.inStock)
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      offers: priced.map(offerFor),
    };
  }

  const defaultVariant = variants[0];
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#product`,
    name: product.name,
    ...(description ? { description } : {}),
    url,
    ...(images.length > 0 ? { image: images } : {}),
    sku: defaultVariant?.sku || defaultVariant?.id,
    brand: { '@type': 'Brand', name: SITE_BRAND },
    ...(product.categoryName ? { category: product.categoryName } : {}),
    ...(offers ? { offers } : {}),
  };
}

/** Migas de pan (Inicio › Producto) para Google. */
export function productBreadcrumbJsonLd(
  product: Pick<SeoProduct, 'slug' | 'name'>,
  appUrl: string,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: absoluteUrl('/', appUrl) },
      {
        '@type': 'ListItem',
        position: 2,
        name: product.name,
        item: absoluteUrl(`/productos/${product.slug}`, appUrl),
      },
    ],
  };
}

/** Serializa JSON-LD para un <script>; "<" escapado para que nunca cierre la etiqueta. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
