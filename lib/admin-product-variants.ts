import { and, eq, inArray, notInArray } from 'drizzle-orm';
import { db } from './db';
import { productVariants, products } from './db/schema';
import type { AdminProductInput } from './validation';
import { inventoryColumns, saleColumns } from './admin-product-columns';
import { attributeKey, type VariationAttribute } from './variations';

export class VariantSaveError extends Error {}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === '23505';
}

/**
 * Guarda las variantes de un producto desde el formulario del admin.
 *
 * - Variaciones desactivadas: una sola variante "Default" con el precio, stock y
 *   oferta del producto. Si antes tenía variaciones, se borran las demás.
 * - Activadas: una variante por combinación. Las que traen `id` se actualizan
 *   (así los pedidos y carritos siguen apuntando a la misma variante), las
 *   nuevas se insertan y las que ya no vienen se borran.
 */
export async function saveProductVariants(
  productId: string,
  d: AdminProductInput,
  currentMetadata: Record<string, unknown>,
): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      if (d.variations?.enabled) {
        await saveAttributeVariants(tx, productId, d, currentMetadata);
      } else {
        await saveSingleVariant(tx, productId, d, currentMetadata, d.variations != null);
      }
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new VariantSaveError('Ese SKU ya lo usa otro producto. Usa uno diferente.');
    }
    throw error;
  }
}

async function saveSingleVariant(
  tx: Tx,
  productId: string,
  d: AdminProductInput,
  currentMetadata: Record<string, unknown>,
  dropOtherVariants: boolean,
) {
  const values = {
    priceAmount: d.price,
    ...saleColumns(d),
    ...inventoryColumns(d),
    updatedAt: new Date(),
  };

  const [defaultVariant] = await tx
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(and(eq(productVariants.productId, productId), eq(productVariants.isDefault, true)))
    .limit(1);

  let keepId: string;
  if (defaultVariant) {
    await tx.update(productVariants).set(values).where(eq(productVariants.id, defaultVariant.id));
    keepId = defaultVariant.id;
  } else {
    const [created] = await tx
      .insert(productVariants)
      .values({ productId, name: 'Default', isDefault: true, ...values })
      .returning({ id: productVariants.id });
    keepId = created.id;
  }

  // Se apagaron las variaciones: queda solo la predeterminada, sin atributos.
  if (dropOtherVariants) {
    await tx
      .delete(productVariants)
      .where(and(eq(productVariants.productId, productId), notInArray(productVariants.id, [keepId])));
    await tx
      .update(productVariants)
      .set({ attributes: {} })
      .where(eq(productVariants.id, keepId));
    if ('variationAttributes' in currentMetadata) {
      const { variationAttributes: _removed, ...rest } = currentMetadata;
      await tx.update(products).set({ metadata: rest }).where(eq(products.id, productId));
    }
  }
}

async function saveAttributeVariants(
  tx: Tx,
  productId: string,
  d: AdminProductInput,
  currentMetadata: Record<string, unknown>,
) {
  const variations = d.variations!;
  const attributes: VariationAttribute[] = variations.attributes.map((a) => ({
    key: attributeKey(a.name),
    name: a.name,
    values: a.values,
  }));

  const existing = await tx
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(eq(productVariants.productId, productId));
  const existingIds = new Set(existing.map((v) => v.id));

  const defaultIndex = Math.max(
    0,
    variations.variants.findIndex((v) => v.isDefault),
  );

  // Primero se borran las que ya no vienen: así una variante nueva puede
  // reutilizar el SKU de una borrada sin chocar con el índice único.
  const incomingIds = new Set(variations.variants.map((v) => v.id).filter(Boolean) as string[]);
  const removed = [...existingIds].filter((id) => !incomingIds.has(id));
  if (removed.length > 0) {
    await tx.delete(productVariants).where(inArray(productVariants.id, removed));
  }

  for (const [index, variant] of variations.variants.entries()) {
    // Solo los atributos definidos, en el orden definido.
    const attrs = Object.fromEntries(attributes.map((a) => [a.key, variant.attributes[a.key]]));
    const values = {
      name: variant.name,
      sku: variant.sku ? variant.sku : null,
      priceAmount: variant.price,
      attributes: attrs,
      isDefault: index === defaultIndex,
      ...saleColumns({ ...d, salePrice: variant.salePrice ?? null }),
      ...inventoryColumns({ ...d, stock: variant.stock ?? null }),
      updatedAt: new Date(),
    };

    if (variant.id && existingIds.has(variant.id)) {
      await tx.update(productVariants).set(values).where(eq(productVariants.id, variant.id));
    } else {
      await tx.insert(productVariants).values({ productId, ...values });
    }
  }

  await tx
    .update(products)
    .set({ metadata: { ...currentMetadata, variationAttributes: attributes } })
    .where(eq(products.id, productId));
}
