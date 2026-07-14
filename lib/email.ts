/**
 * Stub de correo. Por ahora solo registra en consola — NO envía nada externo.
 * Para producción, conecta un proveedor (Resend, SendGrid, SES) aquí dentro.
 * Se deja aislado para que el resto del código no dependa del proveedor.
 */

type OrderEmailPayload = {
  to: string;
  orderNumber: string;
  totalLabel: string;
  downloadLinks: { name: string; url: string }[];
};

export async function sendOrderConfirmation(payload: OrderEmailPayload): Promise<void> {
  // TODO: reemplazar por envío real (Resend/SendGrid/SES).
  console.info('[email:stub] Confirmación de pedido', {
    to: payload.to,
    orderNumber: payload.orderNumber,
    total: payload.totalLabel,
    downloads: payload.downloadLinks.length,
  });
}
