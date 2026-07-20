import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { productVariants, products } from '@/lib/db/schema';
import { formatDecimal } from '@/lib/money';

export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      type: products.type,
      status: products.status,
      currency: products.currency,
      price: productVariants.priceAmount,
    })
    .from(products)
    .leftJoin(
      productVariants,
      eq(productVariants.productId, products.id),
    )
    .where(eq(productVariants.isDefault, true))
    .orderBy(desc(products.createdAt));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Productos</h1>
        <Link
          href="/admin/productos/nuevo"
          className="rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-4 py-2 text-sm font-medium"
        >
          + Nuevo
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-[hsl(var(--muted-foreground))]">
          No hay productos. Crea el primero con “Nuevo”.
        </p>
      ) : (
        <div className="overflow-x-auto border border-[hsl(var(--border))] rounded-xl">
          <table className="w-full text-sm">
            <thead className="text-left text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))]">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
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
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <Link
                        href={`/admin/productos/${p.id}/editar`}
                        className="text-[hsl(var(--primary))] hover:underline"
                      >
                        Editar
                      </Link>
                      <Link
                        href={`/productos/${p.slug}`}
                        className="text-[hsl(var(--muted-foreground))] hover:underline"
                      >
                        Ver ↗
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
