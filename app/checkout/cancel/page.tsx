import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Pago cancelado' };

export default function CancelPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold">Pago cancelado</h1>
      <p className="mt-2 text-[hsl(var(--muted-foreground))]">
        No se realizó ningún cargo. Tu carrito sigue guardado.
      </p>
      <div className="mt-6 flex justify-center gap-4">
        <Link href="/carrito" className="underline underline-offset-4">
          Volver al carrito
        </Link>
        <Link href="/" className="underline underline-offset-4">
          Seguir comprando
        </Link>
      </div>
    </div>
  );
}
