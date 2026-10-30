// Etiquetas del registro de correos (admin: /correos y detalle del pedido).

export const EMAIL_KIND_LABEL: Record<string, string> = {
  order_confirmation: 'Confirmación de compra',
  order_notification: 'Aviso interno de compra',
  order_failed: 'Pago no completado',
  report_ready: 'Reporte listo',
  cart_recovery: 'Carrito abandonado',
  admin_2fa: 'Verificación del admin',
};

export const EMAIL_STATUS_LABEL: Record<string, string> = {
  sent: 'Enviado',
  delivered: 'Entregado',
  delivery_delayed: 'Retrasado',
  bounced: 'Rebotó',
  complained: 'Marcado como spam',
  failed: 'Falló',
  suppressed: 'Suprimido',
};

export function emailStatusClass(status: string): string {
  if (status === 'delivered') return 'text-green-600';
  if (status === 'sent' || status === 'delivery_delayed') return 'text-amber-600';
  return 'text-red-500';
}

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

/** Costos de IA: centavos de dólar, con hasta 4 decimales. */
export function formatUsd(value: number | null | undefined): string {
  return value == null ? '—' : usd.format(value);
}
