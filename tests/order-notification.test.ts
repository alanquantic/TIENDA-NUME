import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { envEmailList } from '../lib/config';
import { renderOrderNotification, type OrderNotificationEmailData } from '../lib/email-templates';
import { isTestPayment } from '../lib/payments/test-payment';

const order: OrderNotificationEmailData = {
  number: 'NUME-1042',
  customerName: 'Ana García',
  customerEmail: 'ana@ejemplo.com',
  customerPhone: null,
  currency: 'MXN',
  items: [{ name: 'Reporte: Pareja', variantName: null, quantity: 1, totalAmount: '299.00', type: 'digital' }],
  subtotalAmount: '299.00',
  discountAmount: '0.00',
  discountCode: null,
  shippingAmount: '0.00',
  taxAmount: '0.00',
  totalAmount: '299.00',
  requiresShipping: false,
  shippingMethod: null,
  shippingAddress: null,
  downloads: [{ name: 'reporte.pdf', url: 'https://tienda.test/api/descargas/token-secreto' }],
  reports: [{ name: 'Reporte: Pareja', url: 'https://generador.test/files/abc/pareja.pdf' }],
  adminUrl: 'https://tienda.test/admin/pedidos/123',
  provider: 'mercadopago',
  isTest: false,
  requiresInvoice: false,
};

describe('envEmailList', () => {
  it('separa por coma o punto y coma y quita comillas y vacíos', () => {
    assert.deepEqual(envEmailList(' "a@x.com", b@x.com ;; c@x.com '), ['a@x.com', 'b@x.com', 'c@x.com']);
    assert.deepEqual(envEmailList(''), []);
    assert.deepEqual(envEmailList(undefined), []);
    assert.deepEqual(envEmailList('sin-arroba'), []);
  });
});

describe('renderOrderNotification', () => {
  it('resume el pedido y enlaza al admin', () => {
    const { subject, html } = renderOrderNotification(order);
    assert.match(subject, /^Nuevo pedido NUME-1042 · .*299\.00.* · Ana García$/);
    assert.ok(html.includes('https://tienda.test/admin/pedidos/123'));
    assert.ok(html.includes('Mercado Pago'));
    assert.ok(html.includes('1 descarga generada'));
  });

  it('no expone los enlaces de descarga ni de reportes del cliente', () => {
    const { html } = renderOrderNotification(order);
    assert.ok(!html.includes('token-secreto'));
    assert.ok(!html.includes('pareja.pdf'));
  });

  it('marca los pedidos de prueba', () => {
    const { subject, html } = renderOrderNotification({ ...order, isTest: true });
    assert.ok(subject.startsWith('[PRUEBA] '));
    assert.ok(html.includes('Pedido de prueba'));
  });
});

describe('isTestPayment', () => {
  it('detecta sandbox y pagos simulados', () => {
    assert.equal(isTestPayment({ metadata: { paymentMode: 'sandbox' }, externalPaymentIntentId: null }), true);
    assert.equal(isTestPayment({ metadata: {}, externalPaymentIntentId: 'SIMULADO-NUME-1' }), true);
    assert.equal(isTestPayment({ metadata: { paymentMode: 'production' }, externalPaymentIntentId: '123' }), false);
  });
});
