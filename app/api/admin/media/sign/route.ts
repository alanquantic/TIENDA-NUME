import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createUploadTarget } from '@/lib/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: z.string().trim().max(120).optional(),
  // 'image' (default) → carpeta images/.
  // 'file'            → carpeta files/ (para PDF/ZIP/EPUB).
  kind: z.enum(['image', 'file']).default('image'),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  }

  try {
    const target = await createUploadTarget(
      parsed.data.filename,
      parsed.data.kind,
      parsed.data.contentType,
    );
    return NextResponse.json(target);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al firmar la subida.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
