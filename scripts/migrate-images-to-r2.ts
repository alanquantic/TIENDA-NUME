// Pasa a Cloudflare R2 las imágenes de productos que todavía viven en
// Cloudinary, en /public del repo o en otro dominio, y reescribe
// products.images con las URLs nuevas.
//
//   npm run media:migrate-r2            → simulación: solo muestra qué haría
//   npm run media:migrate-r2 -- --apply → sube a R2 y actualiza la BD
//
// Es idempotente: la llave en R2 sale de un hash de la URL de origen, así que
// volver a correrlo no duplica archivos, y las imágenes que ya apuntan a
// R2_PUBLIC_URL se saltan. Con --apply deja un respaldo JSON (antes/después
// por producto) para poder revertir.
import '../lib/load-env';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { products } from '../lib/db/schema';
import {
  contentTypeFor,
  extensionOf,
  getR2Config,
  mediaFolder,
  publicUrlFor,
  putObject,
  r2Client,
  safeName,
} from '../lib/r2';

const apply = process.argv.includes('--apply');
const config = getR2Config();

function isOnR2(url: string) {
  return url.startsWith(`${config.publicUrl}/`);
}

/** Llave estable en R2 para una URL de origen. */
function targetKey(source: string) {
  const pathname = source.startsWith('/') ? source : new URL(source).pathname;
  const base = decodeURIComponent(pathname.split('/').pop() ?? 'imagen');
  const ext = extensionOf(base) || 'jpg';
  const hash = createHash('sha1').update(source).digest('hex').slice(0, 8);
  return `${mediaFolder('image', config)}/migrados/${safeName(base)}-${hash}.${ext}`;
}

async function exists(key: string) {
  try {
    await r2Client(config).send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function download(source: string): Promise<{ body: Uint8Array; contentType: string }> {
  if (source.startsWith('/')) {
    const file = path.join(process.cwd(), 'public', ...source.split('/').filter(Boolean));
    return { body: await readFile(file), contentType: contentTypeFor(source, 'image/jpeg') };
  }
  const response = await fetch(source);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const header = response.headers.get('content-type')?.split(';')[0]?.trim();
  return {
    body: new Uint8Array(await response.arrayBuffer()),
    contentType: header?.startsWith('image/') ? header : contentTypeFor(source, 'image/jpeg'),
  };
}

async function main() {
  console.log(`${apply ? 'APLICANDO' : 'SIMULACIÓN'} → bucket ${config.bucket}, carpeta ${mediaFolder('image', config)}/migrados`);

  const rows = await db
    .select({ id: products.id, slug: products.slug, images: products.images })
    .from(products);

  const sources = new Set<string>();
  for (const row of rows) {
    for (const url of (row.images as string[] | null) ?? []) {
      if (url && !isOnR2(url)) sources.add(url);
    }
  }
  console.log(`${rows.length} productos, ${sources.size} imágenes por migrar.`);

  const mapping = new Map<string, string>();
  const failures: { source: string; error: string }[] = [];
  for (const source of sources) {
    const key = targetKey(source);
    const url = publicUrlFor(key, config);
    if (!apply) {
      console.log(`  ${source}\n    → ${url}`);
      mapping.set(source, url);
      continue;
    }
    try {
      if (await exists(key)) {
        console.log(`  ya estaba: ${key}`);
      } else {
        const { body, contentType } = await download(source);
        await putObject(key, body, contentType);
        console.log(`  subida: ${key} (${Math.round(body.byteLength / 1024)} KB)`);
      }
      mapping.set(source, url);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ source, error: message });
      console.error(`  ERROR ${source}: ${message}`);
    }
  }

  const changes: { id: string; slug: string; before: string[]; after: string[] }[] = [];
  for (const row of rows) {
    const before = (row.images as string[] | null) ?? [];
    const after = before.map((url) => mapping.get(url) ?? url);
    if (after.some((url, i) => url !== before[i])) {
      changes.push({ id: row.id, slug: row.slug, before, after });
    }
  }

  if (!apply) {
    console.log(`\nSe actualizarían ${changes.length} productos. Corre con --apply para hacerlo.`);
    return;
  }

  // Respaldo antes de tocar la BD.
  const backup = path.join(tmpdir(), `migracion-imagenes-r2-${Date.now()}.json`);
  await writeFile(backup, JSON.stringify({ failures, changes }, null, 2));
  console.log(`\nRespaldo: ${backup}`);

  for (const change of changes) {
    await db
      .update(products)
      .set({ images: change.after, updatedAt: new Date() })
      .where(eq(products.id, change.id));
  }
  console.log(`Productos actualizados: ${changes.length}. Errores: ${failures.length}.`);
  if (failures.length > 0) {
    console.log('Las imágenes con error se quedaron con su URL original; vuelve a correr el script para reintentarlas.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
