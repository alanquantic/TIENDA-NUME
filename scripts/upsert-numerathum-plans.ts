// Da de alta los Planes Numerathum (Espejo, Horizonte 60, Oráculo 365) como
// productos digitales con variantes por vigencia (Mensual / Anual).
//
//   npm run db:seed:numerathum-plans              → los crea en BORRADOR
//   npm run db:seed:numerathum-plans -- --activate → además los publica
//
// Solo CREA lo que falta: si un plan ya existe no se toca (precios, textos e
// imágenes se editan después en el admin). Con --activate, los planes que ya
// existen en borrador pasan a activos.
import '../lib/load-env';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { config } from '../lib/config';
import { categories, productVariants, products } from '../lib/db/schema';
import {
  NUMERATHUM_PLANS,
  NUMERATHUM_PLANS_CATEGORY_NAME,
  NUMERATHUM_PLANS_CATEGORY_SLUG,
  PLAN_PERIOD_ATTRIBUTE,
} from '../lib/numerathum-plans';

const activate = process.argv.includes('--activate');

const PERIOD_LABEL = { monthly: 'Mensual', annual: 'Anual' } as const;

function description(name: string, monthly: boolean): string {
  const vigencias = monthly
    ? 'Elige la vigencia que prefieras: mensual (1 mes) o anual (12 meses).'
    : 'Disponible exclusivamente con vigencia anual (12 meses).';
  return [
    `Acceso al plan ${name.replace(/^Numerathum\s+/, '')} de Numerathum.`,
    '',
    vigencias,
    '',
    'Pago único por el periodo elegido. Para continuar al terminar tu vigencia, vuelves a comprar tu plan.',
  ].join('\n');
}

async function ensureCategory(): Promise<string> {
  const [existing] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, NUMERATHUM_PLANS_CATEGORY_SLUG))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await db
    .insert(categories)
    .values({
      name: NUMERATHUM_PLANS_CATEGORY_NAME,
      slug: NUMERATHUM_PLANS_CATEGORY_SLUG,
      description: 'Planes de acceso a Numerathum',
    })
    .returning({ id: categories.id });
  console.log(`Categoría creada: ${NUMERATHUM_PLANS_CATEGORY_SLUG}`);
  return created.id;
}

async function upsertPlan(categoryId: string, plan: (typeof NUMERATHUM_PLANS)[number]) {
  const [existing] = await db
    .select({ id: products.id, status: products.status })
    .from(products)
    .where(eq(products.slug, plan.slug))
    .limit(1);

  if (existing) {
    if (activate && existing.status === 'draft') {
      await db
        .update(products)
        .set({ status: 'active', updatedAt: new Date() })
        .where(eq(products.id, existing.id));
      console.log(`Activado: ${plan.slug}`);
    } else {
      console.log(`Ya existe (sin cambios): ${plan.slug}`);
    }
    return;
  }

  const periods = (['monthly', 'annual'] as const).filter((period) => plan.prices[period] !== null);
  const values = periods.map((period) => PERIOD_LABEL[period]);

  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(products)
      .values({
        slug: plan.slug,
        name: plan.name,
        description: description(plan.name, plan.prices.monthly !== null),
        type: 'digital',
        status: activate ? 'active' : 'draft',
        categoryId,
        currency: config.currency,
        images: [plan.image],
        maxPerOrder: 1,
        metadata: {
          source: 'numerathum-plans',
          variationAttributes: [{ key: PLAN_PERIOD_ATTRIBUTE, name: 'Vigencia', values }],
        },
      })
      .returning({ id: products.id });

    await tx.insert(productVariants).values(
      periods.map((period) => ({
        productId: created.id,
        name: PERIOD_LABEL[period],
        sku: `${plan.slug}-${period === 'monthly' ? 'mensual' : 'anual'}`.toUpperCase(),
        priceAmount: plan.prices[period]!,
        stock: 0,
        trackInventory: false,
        attributes: { [PLAN_PERIOD_ATTRIBUTE]: PERIOD_LABEL[period] },
        // La anual queda como predeterminada: es la que se muestra elegida.
        isDefault: period === 'annual',
      })),
    );
  });
  console.log(`Creado (${activate ? 'activo' : 'borrador'}): ${plan.slug}`);
}

async function main() {
  const categoryId = await ensureCategory();
  for (const plan of NUMERATHUM_PLANS) {
    await upsertPlan(categoryId, plan);
  }
  console.log('Listo.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
