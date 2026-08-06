import { NextResponse } from 'next/server';
import { and, desc, eq, ne, or, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { categories, productVariants, products } from '@/lib/db/schema';

export const runtime = 'nodejs';
// Cache CDN 5 min. La lista de productos cambia poco y los posts la consumen
// en cada request desde el sidebar del blog.
export const revalidate = 300;

type ProductPayload = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image: string | null;
  currency: string;
  price: string | null;
  category: string | null;
  url: string;
};

function buildProductUrl(slug: string, origin: string): string {
  return `${origin.replace(/\/$/, '')}/productos/${slug}`;
}

function normalizeText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}+/gu, '');
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  // Acepta una o varias categorias: ?category=A&category=B o CSV en un solo param.
  const categoryValues = url.searchParams
    .getAll('category')
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const keywordValues = url.searchParams
    .getAll('keyword')
    .flatMap((value) => value.split(','))
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
  const excludeSlug = url.searchParams.get('exclude')?.trim();
  const limitRaw = Number.parseInt(url.searchParams.get('limit') ?? '3', 10);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 3, 1), 12);

  const conditions = [eq(products.status, 'active')];
  if (categoryValues.length > 0) {
    const categoryConditions = categoryValues.map(
      (name) => sql`lower(${categories.name}) = lower(${name})`,
    );
    const combined =
      categoryConditions.length === 1
        ? categoryConditions[0]
        : or(...categoryConditions);
    if (combined) conditions.push(combined);
  }
  if (keywordValues.length > 0) {
    const keywordConditions = keywordValues.map((keyword) => {
      const like = `%${keyword}%`;
      return or(
        sql`lower(${products.name}) like ${like}`,
        sql`lower(coalesce(${products.description}, '')) like ${like}`,
        sql`lower(coalesce(${categories.name}, '')) like ${like}`,
      );
    });
    const combined =
      keywordConditions.length === 1
        ? keywordConditions[0]
        : or(...keywordConditions);
    if (combined) conditions.push(combined);
  }
  if (excludeSlug) {
    conditions.push(ne(products.slug, excludeSlug));
  }

  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      description: products.description,
      images: products.images,
      currency: products.currency,
      variantPrice: productVariants.priceAmount,
      isDefault: productVariants.isDefault,
      categoryName: categories.name,
      createdAt: products.createdAt,
    })
    .from(products)
    .innerJoin(productVariants, eq(productVariants.productId, products.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(...conditions))
    .orderBy(desc(products.createdAt));

  // Un producto puede tener varias variantes; nos quedamos con la default
  // (o la primera). Preservamos el orden por fecha.
  const byProduct = new Map<string, ProductPayload>();
  const origin = url.origin;
  for (const r of rows) {
    const existing = byProduct.get(r.id);
    if (existing && !r.isDefault) continue;
    const images = Array.isArray(r.images) ? (r.images as string[]) : [];
    byProduct.set(r.id, {
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      image: images[0] ?? null,
      currency: r.currency,
      price: r.variantPrice,
      category: r.categoryName,
      url: buildProductUrl(r.slug, origin),
    });
  }

  const data = Array.from(byProduct.values())
    .sort((a, b) => {
      if (keywordValues.length === 0) return 0;

      const score = (product: ProductPayload) => {
        const name = normalizeText(product.name);
        const category = normalizeText(product.category);
        const description = normalizeText(product.description);

        return keywordValues.reduce((total, keyword) => {
          if (name.includes(keyword)) return total + 10;
          if (category.includes(keyword)) return total + 4;
          if (description.includes(keyword)) return total + 1;
          return total;
        }, 0);
      };

      return score(b) - score(a);
    })
    .slice(0, limit);

  return NextResponse.json(
    { data },
    {
      headers: {
        // Permite que WEB-NUME (u otro origen público) consuma este endpoint
        // desde el navegador si en el futuro se hace client-side.
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    },
  );
}
