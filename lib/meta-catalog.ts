// Catálogo de productos para Meta (Facebook/Instagram) en formato RSS 2.0 con
// el espacio de nombres g: (el mismo que acepta Google Merchant).
//
// Una fila por VARIANTE: `id` = id de la variante, que es exactamente lo que el
// pixel manda como `content_ids` (ver lib/analytics/meta-pixel.ts). Así cada
// ViewContent / AddToCart / Purchase coincide con un artículo del catálogo y
// funcionan los anuncios dinámicos. `item_group_id` = id del producto.
//
// Sin dependencias de servidor: se prueba con datos de ejemplo.

import { SITE_BRAND, SITE_DESCRIPTION, SITE_TITLE } from './site';
import { formatAmount, isRasterImage, plainText, shareableImages, variantInStock, type SeoVariant } from './seo';
import { variantImage } from './variant-image';

export type CatalogVariant = SeoVariant & {
  attributes: unknown;
  isDefault: boolean;
};

export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  shortDescription: string | null;
  type: 'digital' | 'physical';
  currency: string;
  images: unknown;
  metadata: unknown;
  categoryName: string | null;
  categorySlug: string | null;
  variants: CatalogVariant[];
};

export type MetaCatalogItem = {
  id: string;
  item_group_id: string;
  title: string;
  description: string;
  availability: 'in stock' | 'out of stock';
  condition: 'new';
  price: string;
  sale_price?: string;
  sale_price_effective_date?: string;
  link: string;
  image_link: string;
  additional_image_link: string[];
  brand: string;
  product_type?: string;
  custom_label_0: string;
  custom_label_1?: string;
  custom_label_2?: string;
};

/** Productos marcados en el admin para no anunciarse (p. ej. agendas de años pasados). */
export function isExcludedFromCatalog(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  const value = (metadata as Record<string, unknown>).metaCatalogExclude;
  return value === true || value === 'true';
}

function attributesOf(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

function variantLabel(variant: CatalogVariant): string | null {
  const name = variant.name?.trim();
  if (name && name.toLowerCase() !== 'default') return name;
  const values = Object.values(attributesOf(variant.attributes)).filter(Boolean);
  return values.length > 0 ? values.join(' / ') : null;
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function toDate(value: Date | string | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** ISO 8601 sin milisegundos, en UTC: lo que pide sale_price_effective_date. */
function isoMinute(date: Date): string {
  return `${date.toISOString().slice(0, 16)}Z`;
}

const CUSTOM_TYPE_LABEL = { digital: 'digital', physical: 'fisico' } as const;

export function buildMetaCatalogItems(
  products: CatalogProduct[],
  opts: { appUrl: string; now?: Date },
): MetaCatalogItem[] {
  const now = opts.now ?? new Date();
  const items: MetaCatalogItem[] = [];

  for (const product of products) {
    if (isExcludedFromCatalog(product.metadata)) continue;
    const images = shareableImages(product.images, opts.appUrl);
    const rawImages = Array.isArray(product.images)
      ? (product.images as unknown[]).filter((i): i is string => typeof i === 'string')
      : [];
    const description = truncate(
      plainText(product.description) || plainText(product.shortDescription) || product.name,
      5000,
    );
    const link = `${opts.appUrl.replace(/\/+$/, '')}/productos/${product.slug}`;

    for (const variant of product.variants) {
      // Foto propia de la variante (p. ej. color de la agenda) si existe y es apta.
      const ownImage = variantImage(product.slug, rawImages, attributesOf(variant.attributes));
      const ownImageUrl = ownImage && isRasterImage(ownImage) ? shareableImages([ownImage], opts.appUrl)[0] : null;
      const gallery = ownImageUrl ? [ownImageUrl, ...images.filter((i) => i !== ownImageUrl)] : images;
      // Sin imagen apta (solo SVG o sin fotos) Meta rechazaría el artículo.
      if (gallery.length === 0) continue;

      const label = variantLabel(variant);
      const item: MetaCatalogItem = {
        id: variant.id,
        item_group_id: product.id,
        title: truncate(label ? `${product.name} – ${label}` : product.name, 150),
        description,
        availability: variantInStock(product.type, variant) ? 'in stock' : 'out of stock',
        condition: 'new',
        price: `${formatAmount(variant.priceAmount)} ${product.currency}`,
        link,
        image_link: gallery[0],
        additional_image_link: gallery.slice(1, 11),
        brand: SITE_BRAND,
        ...(product.categoryName ? { product_type: product.categoryName } : {}),
        custom_label_0: CUSTOM_TYPE_LABEL[product.type],
        ...(product.categorySlug ? { custom_label_1: product.categorySlug } : {}),
      };

      // Oferta: solo si es menor al precio regular y no ha terminado. Meta
      // aplica sale_price únicamente dentro de sale_price_effective_date.
      const sale = variant.salePriceAmount;
      const endsAt = toDate(variant.saleEndsAt);
      if (sale && Number(sale) < Number(variant.priceAmount) && !(endsAt && endsAt <= now)) {
        item.sale_price = `${formatAmount(sale)} ${product.currency}`;
        const startsAt = toDate(variant.saleStartsAt);
        if (endsAt) {
          item.sale_price_effective_date = `${isoMinute(startsAt ?? now)}/${isoMinute(endsAt)}`;
        } else if (startsAt && startsAt > now) {
          // Oferta futura sin fin: se publica a partir de su inicio, por un año.
          item.sale_price_effective_date = `${isoMinute(startsAt)}/${isoMinute(new Date(startsAt.getTime() + 365 * 86_400_000))}`;
        }
        const startsOk = !startsAt || startsAt <= now;
        if (startsOk) item.custom_label_2 = 'oferta';
      }

      items.push(item);
    }
  }

  return items;
}

function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // Caracteres de control no válidos en XML 1.0.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

export function renderMetaCatalogRss(items: MetaCatalogItem[], opts: { appUrl: string }): string {
  const base = opts.appUrl.replace(/\/+$/, '');
  const field = (name: string, value: string | undefined) =>
    value === undefined || value === '' ? '' : `\n      <g:${name}>${xml(value)}</g:${name}>`;

  const body = items
    .map((item) => {
      const extraImages = item.additional_image_link
        .map((url) => field('additional_image_link', url))
        .join('');
      return `    <item>${field('id', item.id)}${field('item_group_id', item.item_group_id)}${field('title', item.title)}${field('description', item.description)}${field('availability', item.availability)}${field('condition', item.condition)}${field('price', item.price)}${field('sale_price', item.sale_price)}${field('sale_price_effective_date', item.sale_price_effective_date)}${field('link', item.link)}${field('image_link', item.image_link)}${extraImages}${field('brand', item.brand)}${field('product_type', item.product_type)}${field('custom_label_0', item.custom_label_0)}${field('custom_label_1', item.custom_label_1)}${field('custom_label_2', item.custom_label_2)}
    </item>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${xml(SITE_TITLE)}</title>
    <link>${xml(base)}</link>
    <description>${xml(SITE_DESCRIPTION)}</description>
${body}
  </channel>
</rss>
`;
}
