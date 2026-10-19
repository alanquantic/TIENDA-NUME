import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildInitialMondayJobs } from '../lib/monday/jobs';
import { AGENDA_2027_PRODUCT_ID, MONDAY_JOB_KEY, buildAgenda2027Payload } from '../lib/monday/agenda-2027';
import { NUMERATHUM_PRODUCT_ID, NUMERATHUM_JOB_KEY, buildNumerathumPayload } from '../lib/monday/numerathum';
import { LIBRO_PRODUCT_ID, LIBRO_BOARD_ID, LIBRO_JOB_KEY, buildLibroPayload } from '../lib/monday/libro';
import { deliverMondayOrder, mondayJobDue, type MondayDeliveryStore } from '../lib/monday/delivery';
import { createMondayClient, type MondayClient } from '../lib/monday/client';
import { toMinor } from '../lib/money';
import type { MondayOrder, MondayItem, MondayJob } from '../lib/monday/shared';

const order: MondayOrder = {
  id: 'mixed-order', number: 'TEST-LIBRO', status: 'paid', paidAt: new Date('2026-10-19T02:00:00Z'),
  currency: 'MXN', customerFirstName: 'María', customerLastName: 'López',
  customerEmail: 'cliente@example.test', customerPhone: '5512345678',
  shippingAddress: { line1: 'Calle Ejemplo 10', line2: 'Colonia Centro, interior 2', city: 'CDMX',
    state: 'Ciudad de México', postalCode: '03100', country: 'MX' },
  totalAmount: '4097.00', shippingAmount: '199.00', metadata: {},
  externalPaymentIntentId: 'payment-test', provider: 'paypal',
};
const libro: MondayItem = { productId: LIBRO_PRODUCT_ID, variantName: 'Default', quantity: 2, totalAmount: '1000.00' };
const agenda: MondayItem = { productId: AGENDA_2027_PRODUCT_ID, variantName: 'Morada', quantity: 1, totalAmount: '999.00' };
const numerathum: MondayItem = { productId: NUMERATHUM_PRODUCT_ID, variantName: 'Default', quantity: 1, totalAmount: '1899.00' };
const items = [libro, agenda, numerathum];

describe('Libro: Numerología Cotidiana', () => {
  it('maps the book quantity, net amount, buyer, date and blank status to its board', () => {
    const payload = buildLibroPayload(order, items);
    assert.equal(payload.name, 'María López');
    assert.deepEqual(payload.columns.forma_compra2, { index: 16 });
    assert.equal(payload.columns.numbers9, 2);
    assert.equal(payload.columns.numbers, '1000.00');
    assert.equal(payload.columns.pago, '199.00');
    assert.equal(payload.columns.text7, order.customerEmail);
    assert.deepEqual(payload.columns.phone, { phone: order.customerPhone, countryShortName: 'MX' });
    assert.deepEqual(payload.columns.due_date, { date: '2026-10-18' });
    assert.equal(payload.columns.texto, order.number);
    assert.equal(payload.columns.status3, null);
    for (const key of ['numbers_2', 'numbers_3', 'verificar', 'check', 'files', 'forma_compra', 'text']) {
      assert.ok(!(key in payload.columns));
    }
  });

  it('preserves the address and leading postal zero without writing CP to a phone column', () => {
    const columns = buildLibroPayload(order, items).columns;
    assert.equal(columns.calle, 'Calle Ejemplo 10 · CP: 03100');
    assert.equal(columns.colonia, 'Colonia Centro, interior 2');
    assert.equal(columns.municipio_delegaci_n7, 'CDMX');
    assert.equal(columns.estado31, 'Ciudad de México');
    assert.ok(!('dup__of_municipio_delegaci_n' in columns));
    const migrated = buildLibroPayload(order, items, { postalColumnType: 'text' }).columns;
    assert.equal(migrated.dup__of_municipio_delegaci_n, '03100');
    assert.equal(migrated.calle, 'Calle Ejemplo 10');
  });

  it('maps PayPal and Mercado Pago to the explicit options on this board', () => {
    assert.deepEqual(buildLibroPayload(order, items).columns.estado, { index: 7 });
    assert.deepEqual(buildLibroPayload({ ...order, provider: 'mercadopago' }, items).columns.estado, { index: 8 });
    assert.ok(!('estado' in buildLibroPayload({ ...order, provider: 'stripe' }, items).columns));
  });

  it('allocates discounts across three products without losing or double-counting cents', () => {
    const discounted = { ...order, totalAmount: '3707.21' };
    const amounts = [buildLibroPayload(discounted, items).columns.numbers,
      buildAgenda2027Payload(discounted, items).columns.numbers,
      buildNumerathumPayload(discounted, items).columns.n_meros];
    assert.equal(amounts.reduce<number>((sum, amount) => sum + toMinor(String(amount)), 0), 350821);
    assert.equal(amounts[0], '900.00');
  });

  it('rejects unpaid, missing-book, foreign-currency and invalid-quantity orders', () => {
    assert.throws(() => buildLibroPayload({ ...order, status: 'pending' }, items), /not-paid/);
    assert.throws(() => buildLibroPayload({ ...order, paidAt: null }, items), /not-paid/);
    assert.throws(() => buildLibroPayload(order, [agenda]), /no-libro/);
    assert.throws(() => buildLibroPayload({ ...order, currency: 'USD' }, items), /requires-mxn/);
    for (const quantity of [0, -1, 1.5, NaN]) {
      assert.throws(() => buildLibroPayload(order, [{ ...libro, quantity }]), /invalid-libro-quantity/);
    }
  });

  it('queues the book alone or together with the other boards, never for unrelated products', () => {
    const jobs = buildInitialMondayJobs(order, items);
    assert.equal(Object.keys(jobs).length, 3);
    assert.equal(jobs[LIBRO_JOB_KEY]?.boardId, LIBRO_BOARD_ID);
    assert.equal(jobs[LIBRO_JOB_KEY]?.groupId, 'new_group');
    assert.equal(jobs[LIBRO_JOB_KEY]?.productId, LIBRO_PRODUCT_ID);
    assert.equal(jobs[LIBRO_JOB_KEY]?.kind, 'libro');
    assert.deepEqual(Object.keys(buildInitialMondayJobs(order, [libro])), [LIBRO_JOB_KEY]);
    assert.ok(!(LIBRO_JOB_KEY in buildInitialMondayJobs(order, [agenda, numerathum])));
    const overridden = buildInitialMondayJobs(order, [libro], { [LIBRO_JOB_KEY]: { boardId: '123', groupId: 'custom' } });
    assert.equal(overridden[LIBRO_JOB_KEY]?.boardId, '123');
    assert.equal(overridden[LIBRO_JOB_KEY]?.groupId, 'custom');
  });

  it('skips simulated payments unless explicitly enabled', () => {
    for (const simulated of [{ ...order, metadata: { paymentMode: 'sandbox' } },
      { ...order, externalPaymentIntentId: 'SIMULADO-test' }]) {
      assert.equal(buildInitialMondayJobs(simulated, [libro])[LIBRO_JOB_KEY]?.status, 'skipped');
      assert.equal(buildInitialMondayJobs(simulated, [libro], {
        [LIBRO_JOB_KEY]: { syncTestOrders: true },
      })[LIBRO_JOB_KEY]?.status, 'pending');
    }
  });

  it('retries a failed book independently, recovering a lost response without duplicating any board', async () => {
    const jobs = buildInitialMondayJobs(order, items) as Record<string, MondayJob>;
    const created = new Map<string, string>();
    const calls: string[] = [];
    const client: MondayClient = {
      async inspectOrder(boardId, number, column) {
        assert.equal(number, order.number);
        assert.equal(column, boardId === jobs[NUMERATHUM_JOB_KEY].boardId ? '__pedido_web' : 'texto');
        return { itemId: created.get(boardId) ?? null, postalColumnType: 'phone' };
      },
      async createPurchaseItem(input) {
        calls.push(input.boardId);
        created.set(input.boardId, `item-${input.boardId}`);
        if (input.kind === 'libro') {
          assert.equal(input.payload.columns.numbers9, 2);
          assert.ok(!('numbers_2' in input.payload.columns));
          throw new Error('lost-response');
        }
        return created.get(input.boardId)!;
      },
    };
    function store(key: string): MondayDeliveryStore {
      return {
        async claim() {
          if (!mondayJobDue(jobs[key])) return null;
          jobs[key] = { ...jobs[key], status: 'processing', attempts: jobs[key].attempts + 1, claimId: key };
          return { order, items, job: jobs[key] };
        },
        async finish(_id, _claim, job) { jobs[key] = job; },
      };
    }
    await Promise.all(Object.keys(jobs).map((key) => deliverMondayOrder(order.id, store(key), client)));
    assert.equal(jobs[LIBRO_JOB_KEY].status, 'failed');
    assert.equal(jobs[MONDAY_JOB_KEY].status, 'sent');
    assert.equal(jobs[NUMERATHUM_JOB_KEY].status, 'sent');
    jobs[LIBRO_JOB_KEY].nextAttemptAt = new Date(0).toISOString();
    await Promise.all(Object.keys(jobs).map((key) => deliverMondayOrder(order.id, store(key), client)));
    assert.equal(jobs[LIBRO_JOB_KEY].status, 'sent');
    assert.equal(jobs[LIBRO_JOB_KEY].itemId, `item-${LIBRO_BOARD_ID}`);
    assert.equal(calls.length, 3);
  });

  it('uses the book board and an independent stable idempotency key for the mutation', async () => {
    const client = createMondayClient('test-token', async (_url, init) => {
      const request = JSON.parse(String(init?.body));
      assert.equal(request.variables.boardId, LIBRO_BOARD_ID);
      assert.equal(request.variables.groupId, 'new_group');
      assert.equal(JSON.parse(request.variables.columns).texto, order.number);
      assert.equal((init?.headers as Record<string, string>)['Idempotency-Key'],
        `tienda-nume:libro:${LIBRO_BOARD_ID}:${order.id}`);
      return Response.json({ data: { create_item: { id: 'book-item' } } });
    });
    assert.equal(await client.createPurchaseItem({ boardId: LIBRO_BOARD_ID, groupId: 'new_group',
      orderId: order.id, kind: 'libro', payload: buildLibroPayload(order, items) }), 'book-item');
  });
});
