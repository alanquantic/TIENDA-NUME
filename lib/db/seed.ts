import '../load-env';
import { db } from './index';
import { config } from '../config';
import {
  categories,
  digitalAssets,
  discountCodes,
  productVariants,
  products,
  shippingRates,
} from './schema';

/**
 * Carga datos de ejemplo. Idempotente por columnas únicas (slug/code):
 * re-ejecutarlo no duplica.
 */
async function seed() {
  console.log('Sembrando datos…');

  // ── Categorías ────────────────────────────────────────────────
  const cats = [
    { name: 'Ebooks', slug: 'ebooks', description: 'Libros digitales descargables' },
    { name: 'Cursos', slug: 'cursos', description: 'Cursos en video' },
    { name: 'Ropa', slug: 'ropa', description: 'Prendas' },
    { name: 'Accesorios', slug: 'accesorios', description: 'Accesorios físicos' },
  ];
  await db.insert(categories).values(cats).onConflictDoNothing({ target: categories.slug });
  const allCats = await db.select().from(categories);
  const catId = (slug: string) => allCats.find((c) => c.slug === slug)?.id ?? null;

  // ── Envío ─────────────────────────────────────────────────────
  await db
    .insert(shippingRates)
    .values([
      {
        name: 'Envío estándar (México)',
        countries: ['MX'],
        amount: '5.00',
        freeOverAmount: '50.00',
        sortOrder: 1,
      },
      {
        name: 'Envío internacional',
        countries: [],
        amount: '15.00',
        freeOverAmount: null,
        sortOrder: 2,
      },
    ])
    .onConflictDoNothing();

  // ── Cupón ─────────────────────────────────────────────────────
  await db
    .insert(discountCodes)
    .values({ code: 'BIENVENIDA', type: 'percent', value: '10.00', isActive: true })
    .onConflictDoNothing({ target: discountCodes.code });

  // ── Productos ─────────────────────────────────────────────────
  type Seed = {
    slug: string;
    name: string;
    description: string;
    type: 'digital' | 'physical';
    categorySlug: string;
    image: string;
    variants: { name: string; price: string; stock: number; isDefault?: boolean }[];
    asset?: { fileUrl: string; fileName: string };
  };

  const seeds: Seed[] = [
    {
      slug: 'ebook-introduccion-numerologia',
      name: 'Ebook: Introducción a la Numerología',
      description: 'Guía en PDF para empezar en la numerología, con ejercicios prácticos.',
      type: 'digital',
      categorySlug: 'ebooks',
      image: 'https://picsum.photos/seed/ebook-num/600',
      variants: [{ name: 'Default', price: '9.99', stock: 0, isDefault: true }],
      asset: { fileUrl: 'https://example.com/downloads/ebook-num.pdf', fileName: 'ebook-numerologia.pdf' },
    },
    {
      slug: 'curso-numerologia-basica',
      name: 'Curso en video: Numerología Básica',
      description: 'Curso completo en video con acceso de descarga a las lecciones.',
      type: 'digital',
      categorySlug: 'cursos',
      image: 'https://picsum.photos/seed/curso-num/600',
      variants: [{ name: 'Default', price: '49.00', stock: 0, isDefault: true }],
      asset: { fileUrl: 'https://example.com/downloads/curso-basico.zip', fileName: 'curso-basico.zip' },
    },
    {
      slug: 'camiseta-nume',
      name: 'Camiseta Nume',
      description: 'Camiseta de algodón con el logo de Nume.',
      type: 'physical',
      categorySlug: 'ropa',
      image: 'https://picsum.photos/seed/camiseta/600',
      variants: [
        { name: 'Chica', price: '24.99', stock: 20 },
        { name: 'Mediana', price: '24.99', stock: 20, isDefault: true },
        { name: 'Grande', price: '24.99', stock: 15 },
      ],
    },
    {
      slug: 'taza-nume',
      name: 'Taza Nume',
      description: 'Taza de cerámica de 350 ml.',
      type: 'physical',
      categorySlug: 'accesorios',
      image: 'https://picsum.photos/seed/taza/600',
      variants: [{ name: 'Default', price: '14.99', stock: 50, isDefault: true }],
    },
  ];

  for (const s of seeds) {
    const [product] = await db
      .insert(products)
      .values({
        slug: s.slug,
        name: s.name,
        description: s.description,
        type: s.type,
        status: 'active',
        categoryId: catId(s.categorySlug),
        currency: config.currency,
        images: [s.image],
        weightGrams: s.type === 'physical' ? 300 : null,
      })
      .onConflictDoNothing({ target: products.slug })
      .returning();

    if (!product) {
      console.log(`  · ${s.slug} ya existía, omitido`);
      continue;
    }

    await db.insert(productVariants).values(
      s.variants.map((v) => ({
        productId: product.id,
        name: v.name,
        priceAmount: v.price,
        stock: v.stock,
        trackInventory: s.type === 'physical',
        isDefault: v.isDefault ?? false,
      })),
    );

    if (s.asset) {
      await db.insert(digitalAssets).values({
        productId: product.id,
        fileUrl: s.asset.fileUrl,
        fileName: s.asset.fileName,
        contentType: 'application/octet-stream',
        downloadLimit: 5,
      });
    }
    console.log(`  ✓ ${s.slug}`);
  }

  console.log('Listo.');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
