import Link from 'next/link';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { adminHref } from '@/lib/admin-path';
import { NO_CATEGORY, parseCategoryFilter } from '@/lib/admin/order-filters';
import { db } from '@/lib/db';
import { categories, productVariants, products } from '@/lib/db/schema';
import { formatDecimal } from '@/lib/money';
import { effectivePrice } from '@/lib/sale-price';

export const dynamic = 'force-dynamic';

export default async function AdminHome({ searchParams }: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filter = parseCategoryFilter(searchParams);
  const categoryCondition = !filter.categoryId || filter.error
    ? undefined
    : filter.categoryId === NO_CATEGORY
      ? isNull(products.categoryId)
      : eq(products.categoryId, filter.categoryId);
  const categoryOptions = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .orderBy(asc(categories.name));
  const rows = filter.error ? [] : await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      type: products.type,
      status: products.status,
      currency: products.currency,
      categoryName: categories.name,
      price: productVariants.priceAmount,
      salePrice: productVariants.salePriceAmount,
      saleStartsAt: productVariants.saleStartsAt,
      saleEndsAt: productVariants.saleEndsAt,
    })
    .from(products)
    .leftJoin(
      productVariants,
      eq(productVariants.productId, products.id),
    )
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(eq(productVariants.isDefault, true), categoryCondition))
    .orderBy(desc(products.createdAt));
  const fieldClass = 'h-11 w-full min-w-0 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm outline-none focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Productos</h1>
        <Link
          href={adminHref('/productos/nuevo')}
          className="rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-4 py-2 text-sm font-medium"
        >
          + Nuevo
        </Link>
      </div>

      <form action={adminHref()} method="get" className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-[hsl(var(--border))] p-4">
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <label htmlFor="product-category" className="mb-1.5 block text-sm font-medium">Categoría</label>
          <select id="product-category" name="categoria" defaultValue={filter.categoryId} className={fieldClass}>
            <option value="">Todas las categorías</option>
            {categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            <option value={NO_CATEGORY}>Sin categoría</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={adminHref()} className="inline-flex h-11 items-center rounded-lg border border-[hsl(var(--border))] px-4 text-sm font-medium hover:bg-[hsl(var(--muted))]">Limpiar</Link>
          <button type="submit" className="h-11 rounded-lg bg-[hsl(var(--primary))] px-4 text-sm font-semibold text-white hover:opacity-90">Filtrar</button>
        </div>
      </form>

      {filter.error ? (
        <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">{filter.error}</p>
      ) : rows.length === 0 ? (
        <p className="text-[hsl(var(--muted-foreground))]">
          {filter.categoryId ? 'No hay productos en esta categoría.' : 'No hay productos. Crea el primero con “Nuevo”.'}
        </p>
      ) : (
        <div className="overflow-x-auto border border-[hsl(var(--border))] rounded-xl">
          <table className="w-full text-sm">
            <thead className="text-left text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))]">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Categoría</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Precio</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">{p.categoryName ?? '—'}</td>
                  <td className="px-4 py-3">{p.type === 'digital' ? 'Digital' : 'Físico'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        p.status === 'active'
                          ? 'text-green-600'
                          : 'text-[hsl(var(--muted-foreground))]'
                      }
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {p.price ? formatDecimal(p.price, p.currency) : '—'}
                    {p.price &&
                      p.salePrice &&
                      (() => {
                        const current = effectivePrice({
                          priceAmount: p.price,
                          salePriceAmount: p.salePrice,
                          saleStartsAt: p.saleStartsAt,
                          saleEndsAt: p.saleEndsAt,
                        });
                        return (
                          <span
                            className={`ml-2 text-xs ${
                              current.onSale
                                ? 'font-semibold text-[hsl(var(--primary))]'
                                : 'text-[hsl(var(--muted-foreground))]'
                            }`}
                          >
                            Oferta {formatDecimal(p.salePrice, p.currency)}
                            {current.onSale ? '' : ' (inactiva)'}
                          </span>
                        );
                      })()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <Link
                        href={adminHref(`/productos/${p.id}/editar`)}
                        className="text-[hsl(var(--primary))] hover:underline"
                      >
                        Editar
                      </Link>
                      <Link
                        href={`/productos/${p.slug}`}
                        className="text-[hsl(var(--muted-foreground))] hover:underline"
                      >
                        {p.status === 'active' ? 'Ver ↗' : 'Vista previa ↗'}
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
