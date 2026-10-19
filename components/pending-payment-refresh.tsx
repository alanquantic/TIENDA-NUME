'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const INTERVAL_MS = 5_000;
const MAX_TRIES = 24; // ~2 minutos

/**
 * Mientras el pago está por confirmar, vuelve a pedir la página cada pocos
 * segundos: el aviso de la pasarela suele llegar justo después de que el
 * cliente regresa a la tienda. Pasado un rato se detiene (OXXO, transferencia).
 */
export function PendingPaymentRefresh() {
  const router = useRouter();
  useEffect(() => {
    let tries = 0;
    const id = window.setInterval(() => {
      tries += 1;
      if (tries > MAX_TRIES) {
        window.clearInterval(id);
        return;
      }
      router.refresh();
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [router]);
  return null;
}
