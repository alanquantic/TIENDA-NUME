import '../lib/load-env';
import { and, eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { config } from '../lib/config';
import { AI_REPORT_PRODUCTS } from '../lib/ai-report-products';
import { categories, productVariants, products } from '../lib/db/schema';

const REPORTS_CATEGORY_SLUG = 'reportes-numerologicos';
const REPORTS_CATEGORY_NAME = 'Reportes Numerologicos';
const DEFAULT_PRICE = '209.00';

async function ensureReportsCategory(): Promise<string> {
  const [existing] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, REPORTS_CATEGORY_SLUG))
    .limit(1);

  if (existing) return existing.id;

  const [created] = await db
    .insert(categories)
    .values({
      name: REPORTS_CATEGORY_NAME,
      slug: REPORTS_CATEGORY_SLUG,
      description: 'Reportes digitales de numerologia',
    })
    .returning({ id: categories.id });

  return created.id;
}

async function upsertProduct(categoryId: string, product: (typeof AI_REPORT_PRODUCTS)[number]) {
  const [existing] = await db
    .select()
    .from(products)
    .where(eq(products.slug, product.slug))
    .limit(1);

  if (existing) {
    await db
      .update(products)
      .set({
        name: product.name,
        description: product.description,
        type: 'digital',
        status: 'active',
        categoryId,
        currency: config.currency,
        images: [product.imagePath],
        updatedAt: new Date(),
        metadata: {
          ...(existing.metadata as Record<string, unknown>),
          source: 'codex-ai-reports',
          reportKey: product.report,
          generatorEngine: 'ai',
        },
      })
      .where(eq(products.id, existing.id));

    const [defaultVariant] = await db
      .select()
      .from(productVariants)
      .where(
        and(
          eq(productVariants.productId, existing.id),
          eq(productVariants.isDefault, true),
        ),
      )
      .limit(1);

    if (defaultVariant) {
      await db
        .update(productVariants)
        .set({
          name: 'Default',
          priceAmount: DEFAULT_PRICE,
          stock: 0,
          trackInventory: false,
          updatedAt: new Date(),
        })
        .where(eq(productVariants.id, defaultVariant.id));
    } else {
      await db.insert(productVariants).values({
        productId: existing.id,
        name: 'Default',
        priceAmount: DEFAULT_PRICE,
        stock: 0,
        trackInventory: false,
        isDefault: true,
      });
    }

    console.log(`Actualizado: ${product.slug}`);
    return;
  }

  const [created] = await db
    .insert(products)
    .values({
      slug: product.slug,
      name: product.name,
      description: product.description,
      type: 'digital',
      status: 'active',
      categoryId,
      currency: config.currency,
      images: [product.imagePath],
      metadata: {
        source: 'codex-ai-reports',
        reportKey: product.report,
        generatorEngine: 'ai',
      },
    })
    .returning({ id: products.id });

  await db.insert(productVariants).values({
    productId: created.id,
    name: 'Default',
    priceAmount: DEFAULT_PRICE,
    stock: 0,
    trackInventory: false,
    isDefault: true,
  });

  console.log(`Creado: ${product.slug}`);
}

async function main() {
  const categoryId = await ensureReportsCategory();
  for (const product of AI_REPORT_PRODUCTS) {
    await upsertProduct(categoryId, product);
  }
  console.log('Listo.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
