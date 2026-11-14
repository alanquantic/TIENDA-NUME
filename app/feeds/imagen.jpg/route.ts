import sharp from 'sharp';
import { config } from '@/lib/config';
import { isAllowedFeedImageSource } from '@/lib/meta-catalog';

/**
 * Convierte una imagen de producto a JPG 1080×1080 para el catálogo de Meta,
 * que solo acepta JPG/PNG (muchas imágenes migradas son WebP). No recorta:
 * centra la imagen sobre fondo blanco. Solo acepta imágenes de la propia
 * tienda o de su CDN, así no sirve como proxy abierto.
 *
 * URL: /feeds/imagen.jpg?src=<url de la imagen>
 */
export const dynamic = 'force-dynamic';

const SIZE = 1080;
const MAX_BYTES = 15 * 1024 * 1024;

export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get('src') ?? '';
  if (!isAllowedFeedImageSource(src, config.appUrl)) {
    return new Response('Imagen no permitida', { status: 400 });
  }

  try {
    const upstream = await fetch(src, { signal: AbortSignal.timeout(10_000), cache: 'no-store' });
    if (!upstream.ok) return new Response('Imagen no encontrada', { status: 404 });
    const declared = Number(upstream.headers.get('content-length') ?? 0);
    if (declared > MAX_BYTES) return new Response('Imagen demasiado grande', { status: 413 });
    const input = Buffer.from(await upstream.arrayBuffer());
    if (input.byteLength > MAX_BYTES) return new Response('Imagen demasiado grande', { status: 413 });

    const output = await sharp(input, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(SIZE, SIZE, { fit: 'contain', background: '#ffffff' })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 86, mozjpeg: true })
      .toBuffer();

    return new Response(new Uint8Array(output), {
      headers: {
        'Content-Type': 'image/jpeg',
        // Los nombres de archivo del CDN cambian cuando cambia la imagen.
        'Cache-Control': 'public, max-age=86400, s-maxage=2592000, immutable',
      },
    });
  } catch (error) {
    console.error('[feeds/imagen] no se pudo convertir', src, error);
    return new Response('No se pudo convertir la imagen', {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
