import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ARITHMAX_BOARD_ID, ARITHMAX_GROUP_ID, ARITHMAX_ORDER_COLUMN,
  MONDAY_ARITHMAX_LICENSES, buildArithmaxPayload, arithmaxOrderReference,
} from '../lib/monday/arithmax';
import { buildInitialMondayJobs } from '../lib/monday/jobs';
import { createMondayClient } from '../lib/monday/client';
import { deliverMondayOrder, mondayJobDue, type MondayDeliveryStore } from '../lib/monday/delivery';
import type { MondayOrder, MondayItem, MondayJob } from '../lib/monday/shared';

const order: MondayOrder = {
  id: 'arithmax-order', number: 'NUME-ARITHMAX', status: 'paid', paidAt: new Date('2026-11-18T02:00:00Z'),
  currency: 'MXN', customerFirstName: 'Ana María', customerLastName: 'De la Cruz López',
  customerBirthDate: '1990-08-21', customerEmail: 'cliente@example.test', customerPhone: '5512345678',
  shippingAddress: null, totalAmount: '900.00', shippingAmount: '0.00',
  metadata: {}, externalPaymentIntentId: 'payment-test', provider: 'paypal',
};
const items: MondayItem[] = MONDAY_ARITHMAX_LICENSES.map((license) => ({
  productId: license.productId, variantName: 'Default', quantity: 1, totalAmount: '500.00',
}));

describe('ARITHMAX VERSION 3', () => {
  it('maps each license, ALAN, payment and buyer data to the confirmed columns', () => {
    for (const license of MONDAY_ARITHMAX_LICENSES) {
      const payload = buildArithmaxPayload(order, items, { productId: license.productId });
      assert.equal(payload.name, 'Ana María');
      assert.deepEqual(payload.columns.mm, { ids: [27] });
      assert.deepEqual(payload.columns.color_mkxpqbfg, { index: license.licenseIndex });
      assert.deepEqual(payload.columns.status2, { index: 2 });
      assert.equal(payload.columns.texto0, 'De la Cruz López');
      assert.ok(!('texto5' in payload.columns));
      assert.equal(payload.columns.texto33, order.customerEmail);
      assert.deepEqual(payload.columns.phone1, { phone: '5512345678', countryShortName: 'MX' });
      assert.equal(payload.columns.texto3, 21);
      assert.deepEqual(payload.columns.texto92, { ids: [8] });
      assert.equal(payload.columns.texto1, 1990);
      assert.deepEqual(payload.columns.date_mkxpn5yf, { date: '2026-11-17' });
      assert.equal(payload.columns.__pedido_web, arithmaxOrderReference(order.number, license.productId));
      for (const key of ['files1', 'pago_1', 'verificar']) assert.ok(!(key in payload.columns));
    }
    assert.deepEqual(buildArithmaxPayload({ ...order, provider: 'mercadopago' }, items).columns.status2, { index: 16 });
    assert.ok(!('status2' in buildArithmaxPayload({ ...order, provider: 'stripe' }, items).columns));
  });

  it('allocates only paid license amounts, excluding other products and shipping', () => {
    const mixed = [...items, { ...items[0], productId: 'unrelated', totalAmount: '1000.00' }];
    const paid = { ...order, totalAmount: '1900.00', shippingAmount: '100.00' };
    for (const license of MONDAY_ARITHMAX_LICENSES) {
      const columns = buildArithmaxPayload(paid, mixed, { productId: license.productId }).columns;
      assert.equal(columns.numbers1, '450.00');
      assert.equal(columns.n_meros, '450.00');
    }
  });

  it('queues each license independently, honors sandbox settings and ignores unrelated products', () => {
    const jobs = buildInitialMondayJobs(order, items);
    assert.equal(Object.keys(jobs).length, 2);
    for (const license of MONDAY_ARITHMAX_LICENSES) {
      assert.equal(jobs[license.jobKey]?.boardId, ARITHMAX_BOARD_ID);
      assert.equal(jobs[license.jobKey]?.groupId, ARITHMAX_GROUP_ID);
      assert.equal(jobs[license.jobKey]?.kind, 'arithmax');
      const testOrder = { ...order, externalPaymentIntentId: 'SIMULADO-test' };
      assert.equal(buildInitialMondayJobs(testOrder, items)[license.jobKey]?.status, 'skipped');
      assert.equal(buildInitialMondayJobs(testOrder, items, {
        [license.jobKey]: { syncTestOrders: true, boardId: 'other-board', groupId: 'other-group' },
      })[license.jobKey]?.status, 'pending');
    }
    assert.deepEqual(buildInitialMondayJobs(order, [{ ...items[0], productId: 'unrelated' }]), {});
  });

  it('uses product IDs from the environment and retains each license mapping', () => {
    for (const [index, license] of MONDAY_ARITHMAX_LICENSES.entries()) {
      const previous = process.env[license.productIdEnv];
      const productId = `00000000-0000-4000-8000-00000000000${index}`;
      process.env[license.productIdEnv] = productId;
      try {
        const lines = [{ ...items[0], productId }];
        assert.equal(buildInitialMondayJobs(order, lines)[license.jobKey]?.productId, productId);
        assert.deepEqual(buildInitialMondayJobs(order, [{ ...items[0], productId: license.productId }]), {});
        assert.deepEqual(buildArithmaxPayload(order, lines, { productId }).columns.color_mkxpqbfg,
          { index: license.licenseIndex });
      } finally {
        if (previous === undefined) delete process.env[license.productIdEnv];
        else process.env[license.productIdEnv] = previous;
      }
    }
  });

  it('rejects unpaid orders, invalid dates and quantities, and leaves absent birthdays empty', () => {
    assert.throws(() => buildArithmaxPayload({ ...order, status: 'pending' }, items), /not-paid/);
    assert.throws(() => buildArithmaxPayload({ ...order, currency: 'USD' }, items), /requires-mxn/);
    assert.throws(() => buildArithmaxPayload(order, []), /no-arithmax/);
    assert.throws(() => buildArithmaxPayload(order, items, { productId: 'unknown' }), /unknown-arithmax/);
    for (const quantity of [0, -1, 1.5, NaN]) {
      assert.throws(() => buildArithmaxPayload(order, [{ ...items[0], quantity }]), /quantity/);
    }
    for (const customerBirthDate of ['1990-02-31', 'invalid', '0000-01-01']) {
      assert.throws(() => buildArithmaxPayload({ ...order, customerBirthDate }, items), /birth-date/);
    }
    assert.equal(buildArithmaxPayload({ ...order, customerBirthDate: '2000-02-29' }, items).columns.texto3, 29);
    const absent = buildArithmaxPayload({ ...order, customerBirthDate: null }, items).columns;
    for (const key of ['texto3', 'texto92', 'texto1']) assert.ok(!(key in absent));
  });

  it('recovers a lost response without duplicating either license in the same board', async () => {
    const jobs = buildInitialMondayJobs(order, items) as Record<string, MondayJob>;
    const remote = new Map<string, string>();
    const idempotencyKeys = new Set<string>();
    let mutations = 0;
    let lostResponse = true;
    const client = createMondayClient('test-token', async (_url, init) => {
      const { query, variables } = JSON.parse(String(init?.body));
      if (query.includes('query PurchaseOrder')) {
        assert.equal(variables.orderColumn, ARITHMAX_ORDER_COLUMN);
        const itemId = remote.get(variables.orderNumber);
        return Response.json({ data: { boards: [{ id: ARITHMAX_BOARD_ID, columns: [] }],
          items_page_by_column_values: { items: itemId ? [{ id: itemId,
            column_values: [{ id: ARITHMAX_ORDER_COLUMN, text: variables.orderNumber }] }] : [] } } });
      }
      mutations++;
      const columns = JSON.parse(variables.columns);
      assert.equal(variables.boardId, ARITHMAX_BOARD_ID);
      assert.equal(variables.groupId, ARITHMAX_GROUP_ID);
      assert.equal(columns.n_meros, '450.00');
      const license = MONDAY_ARITHMAX_LICENSES.find((license) =>
        columns.__pedido_web === arithmaxOrderReference(order.number, license.productId))!;
      assert.ok(license);
      assert.deepEqual(columns.color_mkxpqbfg, { index: license.licenseIndex });
      const key = (init?.headers as Record<string, string>)['Idempotency-Key'];
      assert.equal(key, `tienda-nume:arithmax:${ARITHMAX_BOARD_ID}:${order.id}:${license.productId}`);
      idempotencyKeys.add(key);
      remote.set(columns.__pedido_web, `item-${license.slug}`);
      if (lostResponse) { lostResponse = false; throw new Error('lost-response'); }
      return Response.json({ data: { create_item: { id: `item-${license.slug}` } } });
    });
    const store = (key: string): MondayDeliveryStore => ({
      async claim() {
        if (!mondayJobDue(jobs[key])) return null;
        jobs[key] = { ...jobs[key], status: 'processing', attempts: jobs[key].attempts + 1, claimId: key };
        return { order, items, job: jobs[key] };
      },
      async finish(_id, _claim, job) { jobs[key] = job; },
    });
    for (const key of Object.keys(jobs)) await deliverMondayOrder(order.id, store(key), client);
    assert.equal(jobs.mondayArithmax1Year.status, 'failed');
    jobs.mondayArithmax1Year.nextAttemptAt = new Date(0).toISOString();
    for (const key of Object.keys(jobs)) await deliverMondayOrder(order.id, store(key), client);
    assert.ok(Object.values(jobs).every((job) => job.status === 'sent'));
    assert.equal(remote.size, 2);
    assert.equal(idempotencyKeys.size, 2);
    assert.equal(mutations, 2);
  });
});
