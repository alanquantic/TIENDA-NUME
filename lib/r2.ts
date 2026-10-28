import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type _Object,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Almacenamiento de imágenes y archivos descargables en Cloudflare R2 (API S3).
// Todo vive bajo `<R2_PREFIX>/images/` y `<R2_PREFIX>/files/` del bucket; las
// URLs públicas salen de R2_PUBLIC_URL (dominio propio o r2.dev del bucket).
// Solo servidor (sin 'server-only' para que también lo usen los scripts).

export type MediaKind = 'image' | 'file';

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  prefix: string;
  publicUrl: string;
};

export type UploadTarget = {
  upload_url: string;
  method: 'PUT';
  headers: Record<string, string>;
  key: string;
  url: string;
};

export type ListMediaOptions = {
  limit?: number;
  cursor?: string;
};

export type MediaListItem = {
  id: string;
  public_id: string;
  url: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
  format: string | null;
  original_filename: string | null;
  created_at: string | null;
};

export type ListMediaResult = {
  items: MediaListItem[];
  next_cursor: string | null;
  folder: string;
};

const FOLDER: Record<MediaKind, string> = { image: 'images', file: 'files' };

const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  pdf: 'application/pdf',
  zip: 'application/zip',
  epub: 'application/epub+zip',
};

export function getR2Config(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID ?? '';
  const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? '';
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? '';
  const bucket = process.env.R2_BUCKET ?? '';
  const prefix = (process.env.R2_PREFIX ?? 'tienda').replace(/^\/+|\/+$/g, '');
  // Acepta el dominio solo ("cdn.ejemplo.com") o con protocolo.
  const rawPublicUrl = (process.env.R2_PUBLIC_URL ?? '').trim().replace(/\/+$/, '');
  const publicUrl =
    rawPublicUrl && !/^https?:\/\//i.test(rawPublicUrl) ? `https://${rawPublicUrl}` : rawPublicUrl;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) {
    throw new Error(
      'R2 no está configurado. Define R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET y R2_PUBLIC_URL.',
    );
  }

  return { accountId, accessKeyId, secretAccessKey, bucket, prefix, publicUrl };
}

let client: S3Client | null = null;

export function r2Client(config = getR2Config()): S3Client {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return client;
}

/** Carpeta (prefijo de llave) de un tipo de medio, p. ej. "tienda/images". */
export function mediaFolder(kind: MediaKind, config = getR2Config()) {
  return `${config.prefix ? `${config.prefix}/` : ''}${FOLDER[kind]}`;
}

export function publicUrlFor(key: string, config = getR2Config()) {
  return `${config.publicUrl}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

export function extensionOf(filename: string) {
  return /\.([a-z0-9]+)$/i.exec(filename)?.[1]?.toLowerCase() ?? '';
}

export function contentTypeFor(filename: string, fallback = 'application/octet-stream') {
  return CONTENT_TYPES[extensionOf(filename)] ?? fallback;
}

export function safeName(filename: string, fallback = 'imagen') {
  return (
    filename
      .replace(/\.[^.]+$/, '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\w-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
      .slice(0, 80) || fallback
  );
}

/** Sube un objeto desde el servidor (lo usa el script de migración). */
export async function putObject(key: string, body: Uint8Array, contentType: string) {
  const config = getR2Config();
  await r2Client(config).send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
  return publicUrlFor(key, config);
}

/**
 * URL firmada (PUT, 10 min) para que el admin suba directo a R2 desde el
 * navegador. El bucket necesita una regla CORS que permita PUT desde la tienda.
 */
export async function createUploadTarget(
  filename: string,
  kind: MediaKind,
  contentType?: string,
): Promise<UploadTarget> {
  const config = getR2Config();
  const ext = extensionOf(filename);
  const type = contentType || contentTypeFor(filename);
  const key = `${mediaFolder(kind, config)}/${safeName(filename, kind === 'file' ? 'archivo' : 'imagen')}-${Date.now()}${ext ? `.${ext}` : ''}`;
  const cacheControl = 'public, max-age=31536000, immutable';

  const uploadUrl = await getSignedUrl(
    r2Client(config),
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: type,
      CacheControl: cacheControl,
    }),
    { expiresIn: 600 },
  );

  return {
    upload_url: uploadUrl,
    method: 'PUT',
    headers: { 'Content-Type': type, 'Cache-Control': cacheControl },
    key,
    url: publicUrlFor(key, config),
  };
}

function toListItem(object: _Object, config: R2Config): MediaListItem {
  const key = object.Key ?? '';
  const name = key.split('/').pop() ?? key;
  // Quita el sufijo "-<timestamp>" que agrega createUploadTarget.
  const original = name.replace(/-\d{13}(?=\.[^.]+$|$)/, '');
  return {
    id: key,
    public_id: key,
    url: publicUrlFor(key, config),
    width: null,
    height: null,
    bytes: object.Size ?? null,
    format: extensionOf(name) || null,
    original_filename: original,
    created_at: object.LastModified?.toISOString() ?? null,
  };
}

/**
 * Lista los medios de un tipo, del más reciente al más antiguo. R2 lista por
 * orden alfabético, así que se leen todas las llaves de la carpeta (la
 * biblioteca es chica) y el cursor es el desplazamiento dentro de esa lista.
 */
export async function listMedia(
  kind: MediaKind,
  opts: ListMediaOptions = {},
): Promise<ListMediaResult> {
  const config = getR2Config();
  const folder = mediaFolder(kind, config);
  const limit = Math.min(Math.max(opts.limit ?? 24, 1), 50);
  const offset = Math.max(Number(opts.cursor) || 0, 0);

  const objects: _Object[] = [];
  let token: string | undefined;
  do {
    const page = await r2Client(config).send(
      new ListObjectsV2Command({
        Bucket: config.bucket,
        Prefix: `${folder}/`,
        ContinuationToken: token,
      }),
    );
    objects.push(...(page.Contents ?? []).filter((o) => o.Key && !o.Key.endsWith('/')));
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);

  objects.sort(
    (a, b) => (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0),
  );
  const slice = objects.slice(offset, offset + limit);

  return {
    items: slice.map((object) => toListItem(object, config)),
    next_cursor: offset + limit < objects.length ? String(offset + limit) : null,
    folder,
  };
}

/** Borra un medio; solo dentro de la carpeta que gestiona la tienda. */
export async function deleteMedia(kind: MediaKind, key: string): Promise<void> {
  const config = getR2Config();
  const folder = mediaFolder(kind, config);
  if (!key.startsWith(`${folder}/`) || key.includes('..')) {
    throw new Error(`El archivo no pertenece a la carpeta gestionada por la tienda ("${folder}").`);
  }
  await r2Client(config).send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
}
