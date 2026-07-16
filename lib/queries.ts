import 'server-only';
import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm';
import { db } from './db';
import {
  categories,
  digitalAssets,
  productVariants,
  products,
} from './db/schema';

export type CatalogCard = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: 'digital' | 'physical';
  image: string | null;
  currency: string;
  priceAmount: string;
  inStock: boolean;
  variantId: string;
  maxStock: number | null;
  maxPerOrder: number | null;
  categorySlug: string | null;
  categoryName: string | null;
};

/** Productos activos para el catálogo (con la variante por defecto). */
export async function listProducts(
  opts: { categorySlug?: string; categoryId?: string; excludeId?: string } = {},
): Promise<CatalogCard[]> {
  const conditions = [eq(products.status, 'active')];
  if (opts.categoryId) conditions.push(eq(products.categoryId, opts.categoryId));
  if (opts.excludeId) conditions.push(ne(products.id, opts.excludeId));

  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      description: products.description,
      type: products.type,
      images: products.images,
      currency: products.currency,
      maxPerOrder: products.maxPerOrder,
      categorySlug: categories.slug,
      categoryName: categories.name,
      variantId: productVariants.id,
      variantPrice: productVariants.priceAmount,
      variantStock: productVariants.stock,
      variantTrack: productVariants.trackInventory,
      isDefault: productVariants.isDefault,
    })
    .from(products)
    .innerJoin(productVariants, eq(productVariants.productId, products.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(...conditions))
    .orderBy(desc(products.createdAt));

  // Elige la variante por defecto (o la primera) de cada producto.
  const byProduct = new Map<string, CatalogCard>();
  for (const r of rows) {
    if (opts.categorySlug && r.categorySlug !== opts.categorySlug) continue;
    const existing = byProduct.get(r.id);
    const images = (r.images as string[]) ?? [];
    const inStock = r.type === 'digital' || !r.variantTrack || r.variantStock > 0;
    const maxStock = r.type === 'physical' && r.variantTrack ? r.variantStock : null;
    if (!existing || r.isDefault) {
      byProduct.set(r.id, {
        id: r.id,
        slug: r.slug,
        name: r.name,
        description: r.description,
        type: r.type,
        image: images[0] ?? null,
        currency: r.currency,
        priceAmount: r.variantPrice,
        inStock: existing ? existing.inStock || inStock : inStock,
        variantId: r.variantId,
        maxStock,
        maxPerOrder: r.maxPerOrder,
        categorySlug: r.categorySlug,
        categoryName: r.categoryName,
      });
    } else {
      existing.inStock = existing.inStock || inStock;
    }
  }
  return [...byProduct.values()];
}

export async function getProductBySlug(slug: string) {
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.slug, slug), eq(products.status, 'active')))
    .limit(1);

  if (!product) return null;

  const variants = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, product.id))
    .orderBy(desc(productVariants.isDefault), asc(productVariants.name));

  const assets =
    product.type === 'digital'
      ? await db
          .select()
          .from(digitalAssets)
          .where(eq(digitalAssets.productId, product.id))
      : [];

  return { product, variants, assets };
}

export async function getRelatedProducts(
  categoryId: string | null,
  excludeId: string,
  limit = 6,
): Promise<CatalogCard[]> {
  if (!categoryId) return [];
  const list = await listProducts({ categoryId, excludeId });
  return list.slice(0, limit);
}

export async function listCategories() {
  return db.select().from(categories).orderBy(asc(categories.name));
}

// ── Reconciliación del carrito con el catálogo ─────────────────

export type CartVariantData = {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  variantName: string | null;
  priceAmount: string;
  currency: string;
  image: string | null;
  type: 'digital' | 'physical';
  maxStock: number | null;
  maxPerOrder: number | null;
};

export type ReconciledLine =
  | { status: 'ok' | 'remapped'; variantId: string; data: CartVariantData }
  | { status: 'removed'; variantId: string };

const CART_FIELDS = {
  variantId: productVariants.id,
  variantName: productVariants.name,
  priceAmount: productVariants.priceAmount,
  stock: productVariants.stock,
  trackInventory: productVariants.trackInventory,
  isDefault: productVariants.isDefault,
  productId: products.id,
  slug: products.slug,
  name: products.name,
  type: products.type,
  currency: products.currency,
  images: products.images,
  maxPerOrder: products.maxPerOrder,
} as const;

type CartRow = {
  variantId: string;
  variantName: string;
  priceAmount: string;
  stock: number;
  trackInventory: boolean;
  isDefault: boolean;
  productId: string;
  slug: string;
  name: string;
  type: 'digital' | 'physical';
  currency: string;
  images: unknown;
  maxPerOrder: number | null;
};

function toCartData(r: CartRow): CartVariantData {
  const images = (r.images as string[]) ?? [];
  return {
    variantId: r.variantId,
    productId: r.productId,
    slug: r.slug,
    name: r.name,
    variantName: r.variantName && r.variantName !== 'Default' ? r.variantName : null,
    priceAmount: r.priceAmount,
    currency: r.currency,
    image: images[0] ?? null,
    type: r.type,
    maxStock: r.type === 'physical' && r.trackInventory ? r.stock : null,
    maxPerOrder: r.maxPerOrder,
  };
}

/**
 * Reconciliar el carrito contra el catálogo actual:
 * - variante aún válida → 'ok' (datos frescos).
 * - variante ausente pero el producto (por slug) sigue activo → 'remapped'
 *   a su variante por defecto.
 * - ni variante ni producto → 'removed'.
 */
export async function reconcileCart(
  lines: { variantId: string; slug: string }[],
): Promise<ReconciledLine[]> {
  if (lines.length === 0) return [];
  const variantIds = [...new Set(lines.map((l) => l.variantId))];
  const slugs = [...new Set(lines.map((l) => l.slug))];

  const variantRows = (await db
    .select(CART_FIELDS)
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(and(inArray(productVariants.id, variantIds), eq(products.status, 'active')))) as CartRow[];
  const byVariant = new Map(variantRows.map((r) => [r.variantId, toCartData(r)]));

  const slugRows = (await db
    .select(CART_FIELDS)
    .from(products)
    .innerJoin(productVariants, eq(productVariants.productId, products.id))
    .where(and(inArray(products.slug, slugs), eq(products.status, 'active')))) as CartRow[];
  const bySlug = new Map<string, CartVariantData>();
  for (const r of slugRows) {
    const existing = bySlug.get(r.slug);
    if (!existing || r.isDefault) bySlug.set(r.slug, toCartData(r));
  }

  return lines.map((l) => {
    const exact = byVariant.get(l.variantId);
    if (exact) return { status: 'ok', variantId: l.variantId, data: exact };
    const remap = bySlug.get(l.slug);
    if (remap) return { status: 'remapped', variantId: l.variantId, data: remap };
    return { status: 'removed', variantId: l.variantId };
  });
}
