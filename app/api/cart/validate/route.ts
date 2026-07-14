import { NextResponse } from 'next/server';
import { z } from 'zod';
import { reconcileCart } from '@/lib/queries';

export const runtime = 'nodejs';

const schema = z.object({
  lines: z
    .array(z.object({ variantId: z.string(), slug: z.string() }))
    .max(100),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  }
  const lines = await reconcileCart(parsed.data.lines);
  return NextResponse.json({ lines });
}
