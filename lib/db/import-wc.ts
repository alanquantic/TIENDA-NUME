import '../load-env';
import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import { sql } from 'drizzle-orm';
import { db } from './index';
import { config } from '../config';
import { slugify } from '../slug';
import { categories, productVariants, products } from './schema';

/**
 * Importa productos de un export CSV de WooCommerce.
 * - Solo filas con Publicado = 1 (publicados).
 * - Solo productos "simple" (las variaciones/variables de suscripción se omiten).
 * - Tipo "virtual" -> digital; el resto -> físico.
 * Uso:  npm run db:import -- "C:/ruta/al/export.csv"
 */

const args = process.argv.slice(2);
const reset = args.includes('--reset');
const csvPath =
  args.find((a) => !a.startsWith('--')) ??
  'C:/Users/andre/Downloads/wc-product-export-13-7-2026-1783968607050.csv';

const norm = (v: unknown) => (v ?? '').toString().trim();

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#8217;|&rsquo;/gi, '’')
    .replace(/&#8211;|&ndash;/gi, '–')
    .replace(/&#8220;|&#8221;/gi, '"')
    .replace(/&aacute;/gi, 'á')
    .replace(/&eacute;/gi, 'é')
    .replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&ntilde;/gi, 'ñ');
}

/**
 * Convierte HTML de WooCommerce/Elementor en texto estructurado:
 * cada bloque en una línea; las viñetas empiezan con "• ".
 */
function htmlToBlocks(html: string): string {
  let s = html;
  s = s.replace(/<\s*br\s*\/?>/gi, '\n');
  s = s.replace(/<\s*li[^>]*>/gi, '\n• ');
  s = s.replace(/<\s*\/\s*(p|div|h[1-6]|li|ul|ol|section|tr)\s*>/gi, '\n');
  s = s.replace(/<\s*(p|div|h[1-6]|ul|ol|section|tr)[^>]*>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ''); // tags restantes
  s = s.replace(/\[[^\]]+\]/g, ' '); // shortcodes
  s = decodeEntities(s);
  s = s.replace(/\\[nrt]/g, '\n'); // saltos escapados literalmente

  const lines: string[] = [];
  for (const raw of s.split('\n')) {
    const line = raw.replace(/[ \t]+/g, ' ').trim();
    if (!line) continue;
    if (lines.length && lines[lines.length - 1] === line) continue; // dedup consecutivo
    lines.push(line);
  }
  return lines.join('\n');
}

function truncateBlocks(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastNl = cut.lastIndexOf('\n');
  return (lastNl > max * 0.5 ? cut.slice(0, lastNl) : cut).trim();
}

function parsePrice(s: string): string | null {
  const n = parseFloat(s.replace(/[^0-9.]/g, ''));
  if (Number.isNaN(n) || n <= 0) return null;
  return n.toFixed(2);
}

async function main() {
  const raw = readFileSync(csvPath, 'utf8').replace(/^[\s﻿]+/, '');
  const records: Record<string, string>[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
  });

  const published = records.filter((r) => norm(r['Publicado']) === '1');
  const simples = published.filter((r) => norm(r['Tipo']).startsWith('simple'));
  const skippedVariants = published.length - simples.length;

  console.log(`CSV: ${records.length} filas | publicados: ${published.length} | simple: ${simples.length}`);
  console.log(`Se omiten ${skippedVariants} filas variable/variation (suscripciones/planes de pago).`);

  if (reset) {
    const del = await db
      .delete(products)
      .where(sql`${products.metadata}->>'source' = 'woocommerce'`)
      .returning({ id: products.id });
    console.log(`--reset: eliminados ${del.length} productos previos de WooCommerce.`);
  }

  // 1) Categorías (primera categoría de cada producto).
  const catNames = new Set<string>();
  for (const r of simples) {
    const first = norm(r['Categorías']).split(',')[0]?.trim();
    if (first) catNames.add(first);
  }
  if (catNames.size) {
    await db
      .insert(categories)
      .values([...catNames].map((name) => ({ name, slug: slugify(name) })))
      .onConflictDoNothing({ target: categories.slug });
  }
  const allCats = await db.select().from(categories);
  const catIdBySlug = new Map(allCats.map((c) => [c.slug, c.id]));

  // 2) Slugs existentes para evitar colisiones.
  const existing = await db.select({ slug: products.slug }).from(products);
  const usedSlugs = new Set(existing.map((p) => p.slug));
  function uniqueSlug(base: string): string {
    let s = base || 'producto';
    let i = 2;
    while (usedSlugs.has(s)) s = `${base}-${i++}`;
    usedSlugs.add(s);
    return s;
  }

  let created = 0;
  const skipped: string[] = [];
  const flagged: string[] = [];
  const perType = { digital: 0, physical: 0 };

  for (const r of simples) {
    const name = norm(r['Nombre']);
    if (!name) continue;
    const isDigital = norm(r['Tipo']).includes('virtual');
    const type = isDigital ? 'digital' : 'physical';
    const price = parsePrice(norm(r['Precio normal']) || norm(r['Precio rebajado']));
    if (!price) {
      skipped.push(`${name} (sin precio)`);
      continue;
    }

    const catName = norm(r['Categorías']).split(',')[0]?.trim();
    const categoryId = catName ? catIdBySlug.get(slugify(catName)) ?? null : null;
    if (catName && /membres/i.test(catName)) flagged.push(name);

    const shortDesc = htmlToBlocks(norm(r['Descripción corta']));
    const fullDesc = htmlToBlocks(norm(r['Descripción']));
    const description = shortDesc || (fullDesc ? truncateBlocks(fullDesc, 1600) : null);

    const images = norm(r['Imágenes'])
      .split(',')
      .map((u) => u.trim())
      .filter((u) => u.startsWith('http'))
      .slice(0, 5);

    // Stock inteligente para físicos.
    const invStr = norm(r['Inventario']);
    const inStock = norm(r['¿En inventario?']) === '1';
    let stock = 0;
    let trackInventory = false;
    if (type === 'physical') {
      if (invStr && !Number.isNaN(parseInt(invStr, 10))) {
        stock = parseInt(invStr, 10);
        trackInventory = true;
      } else {
        trackInventory = false; // disponible pero sin control de inventario
      }
      // si Woo dice fuera de stock y no hay cantidad, márcalo agotado
      if (!inStock && !invStr) {
        stock = 0;
        trackInventory = true;
      }
    }

    const slug = uniqueSlug(slugify(name));

    const [product] = await db
      .insert(products)
      .values({
        slug,
        name,
        description,
        type,
        status: 'active',
        categoryId,
        currency: config.currency,
        images,
        metadata: { source: 'woocommerce', sku: norm(r['SKU']) },
      })
      .onConflictDoNothing({ target: products.slug })
      .returning();

    if (!product) {
      skipped.push(`${name} (slug duplicado)`);
      continue;
    }

    await db.insert(productVariants).values({
      productId: product.id,
      name: 'Default',
      sku: norm(r['SKU']) || null,
      priceAmount: price,
      stock,
      trackInventory,
      isDefault: true,
    });

    created++;
    perType[type]++;
  }

  console.log('\n──────── RESUMEN ────────');
  console.log(`Creados: ${created}  (digitales: ${perType.digital}, físicos: ${perType.physical})`);
  if (skipped.length) console.log(`Omitidos (${skipped.length}): ${skipped.join('; ')}`);
  if (flagged.length) {
    console.log(
      `\n⚠ Productos de MEMBRESÍA importados como digital (revisar en fase 2 con nume): ${flagged.join(', ')}`,
    );
  }
  console.log('\nNota: los productos digitales se importan SIN archivo de descarga');
  console.log('(el CSV no incluye URLs de archivo). Añádelos en el admin cuando corresponda.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
