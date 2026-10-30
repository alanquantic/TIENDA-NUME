type RecommendationProduct = {
  id: string;
  slug: string;
  categorySlug: string | null;
  inStock: boolean;
};

/** Una sugerencia por categoría, excluyendo todos los productos y categorías del carrito. */
export function selectCartRecommendations<T extends RecommendationProduct>(
  catalog: T[],
  cartSlugs: string[],
  limit = 8,
): T[] {
  if (!cartSlugs.length || limit <= 0) return [];
  const selected = new Set(cartSlugs);
  const excludedCategories = new Set(catalog.filter(p => selected.has(p.slug)).map(p => p.categorySlug));
  const usedCategories = new Set<string>();
  const usedProducts = new Set<string>();
  const result: T[] = [];
  for (const product of catalog) {
    const category = product.categorySlug;
    if (selected.has(product.slug) || !product.inStock || !category ||
        excludedCategories.has(category) || usedCategories.has(category) || usedProducts.has(product.id)) continue;
    result.push(product);
    usedCategories.add(category);
    usedProducts.add(product.id);
    if (result.length >= limit) break;
  }
  return result;
}
