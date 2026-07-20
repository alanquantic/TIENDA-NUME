import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createFileUploadSignature, createUploadSignature } from '@/lib/cloudinary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  filename: z.string().trim().min(1).max(255),
  // 'image' (default) → resource_type image, carpeta base.
  // 'file'            → resource_type raw, subcarpeta /files (para PDF/ZIP/EPUB).
  kind: z.enum(['image', 'file']).default('image'),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  }

  try {
    const signed =
      parsed.data.kind === 'file'
        ? createFileUploadSignature(parsed.data.filename)
        : createUploadSignature(parsed.data.filename);
    return NextResponse.json(signed);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al firmar la subida.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
