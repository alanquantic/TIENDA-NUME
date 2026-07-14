import { listCategories } from '@/lib/queries';
import { config } from '@/lib/config';
import { ProductForm } from '@/components/admin/product-form';

export const dynamic = 'force-dynamic';

export default async function NuevoProductoPage() {
  const categories = await listCategories();
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Nuevo producto</h1>
      <ProductForm
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        defaultCurrency={config.currency}
      />
    </div>
  );
}
