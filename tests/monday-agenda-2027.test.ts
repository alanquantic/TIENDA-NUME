import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AGENDA_2027_PRODUCT_ID, buildAgenda2027Payload, initialAgendaJob,
  type AgendaItem, type AgendaOrder, type MondayJob,
} from '../lib/monday/agenda-2027';
import { createMondayClient, MondayError, type MondayClient } from '../lib/monday/client';
import { deliverMondayOrder, mondayJobDue, type MondayDeliveryStore } from '../lib/monday/delivery';

function order(overrides: Partial<AgendaOrder> = {}): AgendaOrder {
  return {
    id: 'order-123', number: 'NUME-123', status: 'paid', paidAt: new Date('2026-10-17T02:00:00Z'),
    currency: 'MXN', customerFirstName: 'Ana', customerLastName: 'Pérez',
    customerEmail: 'ana@example.test', customerPhone: '5512345678',
    shippingAddress: { line1: 'Calle Uno 12', line2: 'Col. Centro, interior 4',
      city: 'Benito Juárez', state: 'CDMX', postalCode: '03100', country: 'MX' },
    totalAmount: '2148.00', shippingAmount: '150.00', provider: 'paypal',
    metadata: { paymentMode: 'production' }, externalPaymentIntentId: 'payment-123',
    ...overrides,
  };
}
function item(color = 'Morada', quantity = 1, totalAmount = '999.00'): AgendaItem {
  return { productId: AGENDA_2027_PRODUCT_ID, variantName: color, quantity, totalAmount };
}
const items = () => [item(), item('Amarilla')];

describe('Agenda 2027 column mapping', () => {
  it('sends ALAN by index 16, sums both colors and leaves ESTATUS empty', () => {
    const payload = buildAgenda2027Payload(order(), items());
    assert.equal(payload.name, 'Ana Pérez');
    assert.equal(payload.columns.texto, 'NUME-123');
    assert.deepEqual(payload.columns.forma_compra2, { index: 16 });
    assert.equal(payload.columns.numbers9, 2);
    assert.equal(payload.columns.numbers_2, 1);
    assert.equal(payload.columns.numbers_3, 1);
    assert.equal(payload.columns.numbers, '1998.00');
    assert.equal(payload.columns.pago, '150.00');
    assert.equal(payload.columns.status3, null);
    assert.deepEqual(payload.columns.estado, { index: 7 });
    assert.ok(!('verificar' in payload.columns));
    assert.ok(!('check' in payload.columns));
    assert.ok(!('files' in payload.columns));
    assert.ok(!('forma_compra' in payload.columns));
  });

  it('uses quantities, not the number of lines, and handles normalized color names', () => {
    const payload = buildAgenda2027Payload(order({ totalAmount: '5145.00' }), [
      item(' MORADA ', 3, '2997.00'), item('amarilla', 2, '1998.00'),
    ]);
    assert.equal(payload.columns.numbers9, 5);
    assert.equal(payload.columns.numbers_2, 3);
    assert.equal(payload.columns.numbers_3, 2);
  });

  it('uses the purchase date in Mexico City, not UTC or the cron date', () => {
    assert.deepEqual(buildAgenda2027Payload(order(), items()).columns.due_date, { date: '2026-10-16' });
  });

  it('preserves the postal code with leading zeroes in the address while CP remains a phone', () => {
    const columns = buildAgenda2027Payload(order(), items(), { postalColumnType: 'phone' }).columns;
    assert.equal(columns.calle, 'Calle Uno 12 · CP: 03100');
    assert.equal(columns.colonia, 'Col. Centro, interior 4');
    assert.ok(!('dup__of_municipio_delegaci_n' in columns));
    assert.ok(!('n____n__int' in columns));
    assert.deepEqual(columns.phone, { phone: '5512345678', countryShortName: 'MX' });
  });

  it('can fill the CP column if it is changed to text later', () => {
    const columns = buildAgenda2027Payload(order(), items(), { postalColumnType: 'text' }).columns;
    assert.equal(columns.dup__of_municipio_delegaci_n, '03100');
    assert.equal(columns.calle, 'Calle Uno 12');
  });

  it('uses the actual discounted amount paid for an agenda-only order', () => {
    const columns = buildAgenda2027Payload(order({ totalAmount: '1948.20' }), items()).columns;
    assert.equal(columns.numbers, '1798.20');
    assert.equal(columns.pago, '150.00');
  });

  it('excludes other products and apportions a mixed-order discount in cents', () => {
    const columns = buildAgenda2027Payload(order({ totalAmount: '1320.00' }), [
      item('Morada', 1, '1000.00'),
      { productId: 'other-product', variantName: null, quantity: 1, totalAmount: '300.00' },
    ]).columns;
    assert.equal(columns.numbers, '900.00');
    assert.equal(columns.numbers9, 1);
  });

  it('does not label Mercado Pago bank/cash payments as debit or credit', () => {
    assert.ok(!('estado' in buildAgenda2027Payload(order({ provider: 'mercadopago' }), items()).columns));
  });

  it('supports a free order without division by zero', () => {
    assert.equal(buildAgenda2027Payload(order({ totalAmount: '0.00', shippingAmount: '0.00' }), [item('Morada', 1, '0.00')]).columns.numbers, '0.00');
  });

  it('rejects unpaid orders, foreign currencies and unrecognized colors', () => {
    assert.throws(() => buildAgenda2027Payload(order({ status: 'pending' }), items()), /order-not-paid/);
    assert.throws(() => buildAgenda2027Payload(order({ currency: 'USD' }), items()), /requires-mxn/);
    assert.throws(() => buildAgenda2027Payload(order(), [item('Verde')]), /unknown-agenda-color/);
  });

  it('only queues the specified product and skips sandbox/simulated purchases by default', () => {
    assert.equal(initialAgendaJob(order(), [{ ...item(), productId: 'other' }]), null);
    assert.equal(initialAgendaJob(order(), items())?.status, 'pending');
    assert.equal(initialAgendaJob(order({ metadata: { paymentMode: 'sandbox' } }), items())?.status, 'skipped');
    assert.equal(initialAgendaJob(order({ externalPaymentIntentId: 'SIMULADO-NUME-123' }), items())?.status, 'skipped');
    assert.equal(initialAgendaJob(order({ metadata: { paymentMode: 'sandbox' } }), items(), { syncTestOrders: true })?.status, 'pending');
  });
});

describe('monday API client', () => {
  it('uses GraphQL variables and a stable idempotency key for purchase creation', async () => {
    let request: RequestInit | undefined;
    const client = createMondayClient('test-token', async (_url, init) => {
      request = init;
      return Response.json({ data: { create_item: { id: 'monday-123' } } });
    });
    const payload = buildAgenda2027Payload(order({ customerFirstName: 'Ana "Prueba"' }), items());
    assert.equal(await client.createPurchaseItem({ boardId: '18434858318', groupId: 'new_group', orderId: 'order-123', payload }), 'monday-123');
    const body = JSON.parse(String(request!.body));
    assert.equal(body.variables.name, 'Ana "Prueba" Pérez');
    assert.equal(body.variables.groupId, 'new_group');
    assert.deepEqual(JSON.parse(body.variables.columns).forma_compra2, { index: 16 });
    assert.equal((request!.headers as Record<string, string>)['Idempotency-Key'], 'tienda-nume:agenda-2027:18434858318:order-123');
  });

  it('treats GraphQL errors in HTTP 200 as failures and does not store PII from messages', async () => {
    const client = createMondayClient('test-token', async () => Response.json({
      errors: [{ message: 'private customer data', extensions: { code: 'ColumnValueException' } }],
    }));
    await assert.rejects(client.createPurchaseItem({ boardId: '1', groupId: 'new_group', orderId: '1', payload: buildAgenda2027Payload(order(), items()) }),
      (error: unknown) => error instanceof MondayError && error.code === 'monday-ColumnValueException');
  });

  it('requires an exact web-order match before considering an item already sent', async () => {
    const client = createMondayClient('test-token', async () => Response.json({ data: {
      boards: [{ id: '18434858318', columns: [{ id: 'dup__of_municipio_delegaci_n', type: 'phone' }] }],
      items_page_by_column_values: { items: [
        { id: 'wrong', column_values: [{ id: 'texto', text: 'NUME-1234' }] },
        { id: 'right', column_values: [{ id: 'texto', text: 'NUME-123' }] },
      ] },
    } }));
    assert.equal((await client.inspectOrder('18434858318', 'NUME-123')).itemId, 'right');
  });
});

function memoryStore() {
  let job = initialAgendaJob(order(), items())!;
  const store: MondayDeliveryStore = {
    async claim() {
      if (!mondayJobDue(job)) return null;
      job = { ...job, status: 'processing', attempts: job.attempts + 1,
        claimId: `claim-${job.attempts + 1}`, startedAt: new Date().toISOString() };
      return { order: order(), items: items(), job };
    },
    async finish(_orderId, claimId, next) { if (job.claimId === claimId) job = next; },
  };
  return { store, read: () => job, retry: () => { job = { ...job, nextAttemptAt: new Date(0).toISOString() }; } };
}

describe('durable delivery and duplicate protection', () => {
  it('creates one item for concurrent notifications and never repeats a successful delivery', async () => {
    const memory = memoryStore();
    let creates = 0;
    const client: MondayClient = {
      async inspectOrder() { return { itemId: null, postalColumnType: 'phone' }; },
      async createPurchaseItem() { creates++; return 'item-1'; },
    };
    await Promise.all([deliverMondayOrder('order-123', memory.store, client), deliverMondayOrder('order-123', memory.store, client)]);
    await deliverMondayOrder('order-123', memory.store, client);
    assert.equal(creates, 1);
    assert.equal(memory.read().status, 'sent');
    assert.equal(memory.read().itemId, 'item-1');
  });

  it('recovers an ambiguous timeout using # PEDIDO WEB even after the idempotency window', async () => {
    const memory = memoryStore();
    let remoteItem: string | null = null;
    let creates = 0;
    const client: MondayClient = {
      async inspectOrder() { return { itemId: remoteItem, postalColumnType: 'phone' }; },
      async createPurchaseItem() { creates++; remoteItem = 'item-created-before-timeout'; throw new Error('network timeout'); },
    };
    assert.equal(await deliverMondayOrder('order-123', memory.store, client), 'failed');
    assert.equal(memory.read().error, 'monday-request-failed');
    assert.equal(memory.read().attempts, 1);
    memory.retry();
    assert.equal(await deliverMondayOrder('order-123', memory.store, client), 'sent');
    assert.equal(creates, 1);
    assert.equal(memory.read().itemId, remoteItem);
  });

  it('bounds retries and only reclaims abandoned work after the lease expires', () => {
    const job = initialAgendaJob(order(), items())!;
    assert.equal(mondayJobDue({ ...job, status: 'processing', startedAt: new Date().toISOString() }), false);
    assert.equal(mondayJobDue({ ...job, status: 'processing', startedAt: new Date(Date.now() - 360_000).toISOString() }), true);
    assert.equal(mondayJobDue({ ...job, attempts: 8 }), false);
    assert.equal(mondayJobDue({ ...job, nextAttemptAt: new Date(Date.now() + 360_000).toISOString() }), false);
  });
});
