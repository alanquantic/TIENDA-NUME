import 'server-only';
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from './db';
import { categories, productVariants, products } from './db/schema';
import type { CatalogProduct } from './meta-catalog';

export type PublishedProduct = CatalogProduct & { updatedAt: Date };

/**
 * Productos publicados (activos y no borrados) con su categoría y TODAS sus
 * variantes. Fuente del sitemap y del catálogo de Meta.
 */
export async function listPublishedCatalog(): Promise<PublishedProduct[]> {
  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      description: products.description,
      shortDescription: products.shortDescription,
      type: products.type,
      currency: products.currency,
      images: products.images,
      metadata: products.metadata,
      updatedAt: products.updatedAt,
      categoryName: categories.name,
      categorySlug: categories.slug,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.status, 'active'), isNull(products.deletedAt)))
    .orderBy(asc(products.name));

  if (rows.length === 0) return [];

  const variants = await db
    .select()
    .from(productVariants)
    .where(inArray(productVariants.productId, rows.map((row) => row.id)))
    .orderBy(desc(productVariants.isDefault), asc(productVariants.name));

  const byProduct = new Map<string, typeof variants>();
  for (const variant of variants) {
    const list = byProduct.get(variant.productId) ?? [];
    list.push(variant);
    byProduct.set(variant.productId, list);
  }

  return rows.map((row) => ({
    ...row,
    variants: (byProduct.get(row.id) ?? []).map((variant) => ({
      id: variant.id,
      name: variant.name,
      sku: variant.sku,
      priceAmount: variant.priceAmount,
      salePriceAmount: variant.salePriceAmount,
      saleStartsAt: variant.saleStartsAt,
      saleEndsAt: variant.saleEndsAt,
      stock: variant.stock,
      trackInventory: variant.trackInventory,
      attributes: variant.attributes,
      isDefault: variant.isDefault,
    })),
  }));
}
