import { config } from '@/lib/config';
import {
  renderOrderConfirmation,
  renderOrderFailed,
  type OrderEmailData,
} from '@/lib/email-templates';

export const runtime = 'nodejs';

const sample: OrderEmailData = {
  number: 'NUME-EJEMPLO01',
  customerName: 'Ana García López',
  customerEmail: 'ana@ejemplo.com',
  customerPhone: '55 1234 5678',
  currency: config.currency,
  items: [
    {
      name: 'Reporte: Numerología de Pareja',
      variantName: null,
      quantity: 1,
      totalAmount: '299.00',
      type: 'digital',
    },
    {
      name: 'Agenda Numerológica 2026 Física',
      variantName: null,
      quantity: 2,
      totalAmount: '1398.00',
      type: 'physical',
    },
  ],
  subtotalAmount: '1697.00',
  discountAmount: '169.70',
  discountCode: 'BIENVENIDA',
  shippingAmount: '0.00',
  taxAmount: '244.37',
  totalAmount: '1771.67',
  requiresShipping: true,
  shippingMethod: 'Envío estándar (México)',
  shippingAddress: {
    name: 'Ana García López',
    line1: 'Av. Reforma 123',
    line2: 'Depto 4',
    city: 'Ciudad de México',
    state: 'CDMX',
    postalCode: '06600',
    country: 'MX',
  },
  downloads: [{ name: 'reporte-pareja.pdf', url: `${config.appUrl}/api/descargas/ejemplo` }],
};

// Vista previa de los templates (protegida por el middleware de /api/admin/*).
// Uso: /api/admin/email-preview?type=confirmation  |  ?type=failed
export async function GET(req: Request) {
  const type = new URL(req.url).searchParams.get('type') ?? 'confirmation';
  const { html } =
    type === 'failed' ? renderOrderFailed(sample) : renderOrderConfirmation(sample);
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
