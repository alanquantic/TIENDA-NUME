import 'server-only';
import { createHash } from 'node:crypto';

export type CloudinaryConfig = {
  apiKey: string;
  apiSecret: string;
  cloudName: string;
  uploadFolder: string;
};

export type CloudinaryAsset = {
  asset_id?: string;
  public_id: string;
  secure_url: string;
  bytes?: number;
  width?: number;
  height?: number;
  format?: string;
  created_at?: string;
  original_filename?: string;
};

export type CloudinaryListResponse = {
  resources?: CloudinaryAsset[];
  next_cursor?: string;
};

export type UploadSignatureResult = {
  api_key: string;
  cloud_name: string;
  folder: string;
  public_id: string;
  signature: string;
  tags: string;
  timestamp: number;
  upload_url: string;
};

export type ListImagesOptions = {
  limit?: number;
  cursor?: string;
};

export type ListImagesResult = {
  items: {
    id: string;
    public_id: string;
    url: string;
    width: number | null;
    height: number | null;
    bytes: number | null;
    format: string | null;
    original_filename: string | null;
    created_at: string | null;
  }[];
  next_cursor: string | null;
  folder: string;
};

function parseCloudinaryUrl(cloudinaryUrl: string) {
  try {
    const url = new URL(cloudinaryUrl);
    if (url.protocol !== 'cloudinary:') return null;
    return {
      apiKey: decodeURIComponent(url.username),
      apiSecret: decodeURIComponent(url.password),
      cloudName: url.hostname,
    };
  } catch {
    return null;
  }
}

export function getCloudinaryConfig(): CloudinaryConfig {
  const parsed = process.env.CLOUDINARY_URL
    ? parseCloudinaryUrl(process.env.CLOUDINARY_URL)
    : null;

  const apiKey = parsed?.apiKey ?? process.env.CLOUDINARY_API_KEY ?? '';
  const apiSecret = parsed?.apiSecret ?? process.env.CLOUDINARY_API_SECRET ?? '';
  const cloudName = parsed?.cloudName ?? process.env.CLOUDINARY_CLOUD_NAME ?? '';
  const uploadFolder = process.env.CLOUDINARY_UPLOAD_FOLDER ?? 'tienda-nume';

  if (!apiKey || !apiSecret || !cloudName) {
    throw new Error(
      'Cloudinary no está configurado. Define CLOUDINARY_URL o CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET.',
    );
  }

  return { apiKey, apiSecret, cloudName, uploadFolder };
}

function signParams(params: Record<string, string>, apiSecret: string) {
  const toSign = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  return createHash('sha1').update(`${toSign}${apiSecret}`).digest('hex');
}

function safeName(filename: string, fallback = 'imagen') {
  return (
    filename
      .replace(/\.[^.]+$/, '')
      .normalize('NFD')
      .replace(/[^\w-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
      .slice(0, 80) || fallback
  );
}

/** Subcarpeta para archivos descargables (PDF/ZIP/EPUB) dentro de uploadFolder. */
export function filesSubfolder(config: CloudinaryConfig) {
  return `${config.uploadFolder}/files`;
}

export function createUploadSignature(filename: string): UploadSignatureResult {
  const config = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = {
    folder: config.uploadFolder,
    public_id: `${safeName(filename)}-${timestamp}`,
    tags: 'tienda-nume,product',
    timestamp: String(timestamp),
  };

  const signature = signParams(paramsToSign, config.apiSecret);

  return {
    api_key: config.apiKey,
    cloud_name: config.cloudName,
    folder: paramsToSign.folder,
    public_id: paramsToSign.public_id,
    signature,
    tags: paramsToSign.tags,
    timestamp,
    upload_url: `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
  };
}

/**
 * Firma una subida para un archivo descargable (PDF/ZIP/EPUB/…).
 * Usa resource_type=raw para que Cloudinary lo entregue tal cual, sin
 * la restricción "PDF delivery" que aplica al recurso image.
 */
export function createFileUploadSignature(filename: string): UploadSignatureResult {
  const config = getCloudinaryConfig();
  const folder = filesSubfolder(config);
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = {
    folder,
    public_id: `${safeName(filename, 'archivo')}-${timestamp}`,
    tags: 'tienda-nume,digital-asset',
    timestamp: String(timestamp),
  };

  const signature = signParams(paramsToSign, config.apiSecret);

  return {
    api_key: config.apiKey,
    cloud_name: config.cloudName,
    folder,
    public_id: paramsToSign.public_id,
    signature,
    tags: paramsToSign.tags,
    timestamp,
    upload_url: `https://api.cloudinary.com/v1_1/${config.cloudName}/raw/upload`,
  };
}

/** Borra un archivo raw (subido con createFileUploadSignature). */
export async function destroyRawResource(publicId: string): Promise<void> {
  const config = getCloudinaryConfig();

  const expectedPrefix = `${filesSubfolder(config)}/`;
  if (!publicId.startsWith(expectedPrefix)) {
    throw new Error(
      `El archivo no pertenece a la carpeta gestionada por la tienda ("${filesSubfolder(config)}").`,
    );
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = {
    public_id: publicId,
    timestamp: String(timestamp),
  };
  const signature = signParams(paramsToSign, config.apiSecret);

  const form = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: config.apiKey,
    signature,
  });

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/raw/destroy`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    },
  );

  if (!response.ok) {
    throw new Error(`Cloudinary respondió ${response.status} al borrar el archivo.`);
  }

  const payload = (await response.json()) as { result?: string };
  if (payload.result !== 'ok' && payload.result !== 'not found') {
    throw new Error(`Cloudinary devolvió result="${payload.result ?? 'desconocido'}".`);
  }
}

export async function destroyImage(publicId: string): Promise<void> {
  const config = getCloudinaryConfig();

  const expectedPrefix = `${config.uploadFolder}/`;
  if (!publicId.startsWith(expectedPrefix)) {
    throw new Error(
      `La imagen no pertenece a la carpeta gestionada por la tienda ("${config.uploadFolder}").`,
    );
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = {
    public_id: publicId,
    timestamp: String(timestamp),
  };
  const signature = signParams(paramsToSign, config.apiSecret);

  const form = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: config.apiKey,
    signature,
  });

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/image/destroy`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    },
  );

  if (!response.ok) {
    throw new Error(`Cloudinary respondió ${response.status} al borrar la imagen.`);
  }

  const payload = (await response.json()) as { result?: string };
  if (payload.result !== 'ok' && payload.result !== 'not found') {
    throw new Error(`Cloudinary devolvió result="${payload.result ?? 'desconocido'}".`);
  }
}

async function fetchCloudinaryResources(
  resourceType: 'image' | 'raw',
  prefix: string,
  limit: number,
  cursor: string | undefined,
) {
  const config = getCloudinaryConfig();
  const params = new URLSearchParams({
    prefix: `${prefix}/`,
    max_results: String(limit),
    type: 'upload',
  });
  if (cursor) params.set('next_cursor', cursor);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/resources/${resourceType}/upload?${params.toString()}`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${config.apiKey}:${config.apiSecret}`,
        ).toString('base64')}`,
      },
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    throw new Error(`Error ${response.status} al listar recursos.`);
  }

  return (await response.json()) as CloudinaryListResponse;
}

export async function listImages(opts: ListImagesOptions = {}): Promise<ListImagesResult> {
  const config = getCloudinaryConfig();
  const limit = Math.min(Math.max(opts.limit ?? 24, 1), 50);
  const payload = await fetchCloudinaryResources(
    'image',
    config.uploadFolder,
    limit,
    opts.cursor,
  );

  return {
    items: (payload.resources ?? [])
      // Excluye recursos que estén dentro de la subcarpeta /files (archivos raw).
      .filter((asset) => !asset.public_id.startsWith(`${filesSubfolder(config)}/`))
      .map((asset) => ({
        id: asset.asset_id ?? asset.public_id,
        public_id: asset.public_id,
        url: asset.secure_url,
        width: asset.width ?? null,
        height: asset.height ?? null,
        bytes: asset.bytes ?? null,
        format: asset.format ?? null,
        original_filename: asset.original_filename ?? null,
        created_at: asset.created_at ?? null,
      })),
    next_cursor: payload.next_cursor ?? null,
    folder: config.uploadFolder,
  };
}

export async function listFiles(opts: ListImagesOptions = {}): Promise<ListImagesResult> {
  const config = getCloudinaryConfig();
  const limit = Math.min(Math.max(opts.limit ?? 24, 1), 50);
  const folder = filesSubfolder(config);
  const payload = await fetchCloudinaryResources('raw', folder, limit, opts.cursor);

  return {
    items: (payload.resources ?? []).map((asset) => ({
      id: asset.asset_id ?? asset.public_id,
      public_id: asset.public_id,
      url: asset.secure_url,
      width: null,
      height: null,
      bytes: asset.bytes ?? null,
      format: asset.format ?? null,
      original_filename: asset.original_filename ?? null,
      created_at: asset.created_at ?? null,
    })),
    next_cursor: payload.next_cursor ?? null,
    folder,
  };
}
