import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MONDAY_REPORTS, REPORTS_BOARD_ID, REPORTS_ORDER_COLUMN,
  buildReportPayload, reportOrderReference,
} from '../lib/monday/reports';
import { buildInitialMondayJobs } from '../lib/monday/jobs';
import { createMondayClient } from '../lib/monday/client';
import { deliverMondayOrder, mondayJobDue, type MondayDeliveryStore } from '../lib/monday/delivery';
import type { MondayOrder, MondayItem, MondayJob } from '../lib/monday/shared';

const order: MondayOrder = {
  id: 'reports-order', number: 'NUME-REPORTS', status: 'paid', paidAt: new Date('2026-11-18T02:00:00Z'),
  currency: 'MXN', customerFirstName: 'Ana María', customerLastName: 'De la Cruz López',
  customerBirthDate: '1990-08-21', customerEmail: 'cliente@example.test', customerPhone: '5512345678',
  shippingAddress: null, totalAmount: '900.00', shippingAmount: '0.00',
  metadata: {}, externalPaymentIntentId: 'payment-test', provider: 'paypal',
};
const line = (productId: string): MondayItem => ({
  productId, variantName: 'Default', quantity: 1, totalAmount: '100.00',
});

describe('Reportes numerológicos: tablero por producto', () => {
  it('routes the eleven supported products to their groups with independent references', () => {
    for (const report of MONDAY_REPORTS) {
      const jobs = buildInitialMondayJobs(order, [line(report.productId)]);
      assert.deepEqual(Object.keys(jobs), [`mondayReport${report.key}`]);
      const job = jobs[`mondayReport${report.key}`]!;
      assert.equal(job.kind, 'report');
      assert.equal(job.boardId, REPORTS_BOARD_ID);
      assert.equal(job.groupId, report.groupId);
      const payload = buildReportPayload(order, [line(report.productId)], { productId: report.productId });
      assert.equal(payload.orderNumber, `${order.number}:${report.slug}`);
      assert.deepEqual(payload.columns.status9, { index: 1 });
    }
    const first = MONDAY_REPORTS[0], legacy = MONDAY_REPORTS[1];
    assert.equal(first.groupId, legacy.groupId);
    assert.notEqual(reportOrderReference(order.number, first.productId), reportOrderReference(order.number, legacy.productId));
  });

  it('excludes the five products without a group, even in mixed report purchases', () => {
    const excluded = [
      'adc2375d-404d-4b3f-a785-90289654c659', 'c360e776-0c9c-466d-ba2f-7c0aed46819b',
      '0e9296a6-852f-4631-8ea1-a8dd6b6f8def', '857a4de0-9acc-47ad-886d-bf152a66a804',
      '4af4e2c8-9bc5-4725-99fe-3d39fc335028',
    ].map(line);
    assert.deepEqual(buildInitialMondayJobs(order, excluded), {});
    assert.deepEqual(Object.keys(buildInitialMondayJobs(order, [...excluded, line(MONDAY_REPORTS[0].productId)])),
      ['mondayReportWhoAmI']);
  });

  it('uses the report recipient and partner from the correct metadata, retaining buyer contact data', () => {
    const report = MONDAY_REPORTS.find((r) => r.key === 'CoupleNumerology')!;
    const item = { ...line(report.productId), metadata: { reports: [
      { key: 'another-report', person: { name: 'Incorrecta', birthDate: '1970-01-01' } },
      { key: report.reportKey, person: { name: 'María del Regalo', birthDate: '1985-02-20' },
        partner: { name: 'José Pareja', birthDate: '1980-12-31' } },
    ] } };
    const { name, columns } = buildReportPayload(order, [item], { productId: report.productId });
    assert.equal(name, 'María del Regalo');
    assert.ok(!('texto0' in columns));
    assert.ok(!('texto5' in columns));
    assert.equal(columns.texto33, order.customerEmail);
    assert.deepEqual(columns.phone1, { phone: order.customerPhone, countryShortName: 'MX' });
    assert.equal(columns.texto3, 20);
    assert.deepEqual(columns.texto92, { ids: [2] });
    assert.equal(columns.texto1, 1985);
    assert.equal(columns.text_mkq0px85, 'José Pareja');
    assert.equal(columns.numeric_mkq0faq4, 31);
    assert.deepEqual(columns.dropdown_mkq061qa, { ids: [12] });
    assert.equal(columns.numeric_mkq0a358, 1980);
    const historical = { ...item, metadata: { report: item.metadata.reports[1] } };
    assert.equal(buildReportPayload(order, [historical], { productId: report.productId }).name, name);
  });

  it('falls back to buyer data when no report input exists and maps confirmed payment options', () => {
    const productId = MONDAY_REPORTS[0].productId;
    const items = [line(productId)];
    const { name, columns } = buildReportPayload(order, items, { productId });
    assert.equal(name, order.customerFirstName);
    assert.equal(columns.texto0, order.customerLastName);
    assert.equal(columns.texto3, 21);
    assert.deepEqual(columns.texto92, { ids: [8] });
    assert.equal(columns.texto1, 1990);
    assert.deepEqual(columns.date_mkq01sah, { date: '2026-11-17' });
    assert.deepEqual(columns.status2, { index: 2 });
    assert.deepEqual(buildReportPayload({ ...order, provider: 'stripe' }, items, { productId }).columns.status2, { index: 108 });
    assert.ok(!('status2' in buildReportPayload({ ...order, provider: 'mercadopago' }, items, { productId }).columns));
    for (const key of ['pago_1', 'mm', 'text_mkq0px85', 'numeric_mkq0faq4', 'dropdown_mkq061qa', 'numeric_mkq0a358']) {
      assert.ok(!(key in columns));
    }
  });

  it('allocates net paid amounts without attributing shipping or other products to reports', () => {
    const items = [...MONDAY_REPORTS.slice(0, 2).map((r) => line(r.productId)), { ...line('other'), totalAmount: '200.00' }];
    const paid = { ...order, totalAmount: '370.00', shippingAmount: '10.00' };
    for (const report of MONDAY_REPORTS.slice(0, 2)) {
      const { columns } = buildReportPayload(paid, items, { productId: report.productId });
      assert.equal(columns.numbers1, '90.00');
      assert.equal(columns.n_meros, '90.00');
    }
  });

  it('reads each product and group from its environment variables', () => {
    for (const report of MONDAY_REPORTS) {
      const productKey = `MONDAY_REPORTS_${report.envKey}_PRODUCT_ID`;
      const groupKey = `MONDAY_REPORTS_${report.envKey}_GROUP_ID`;
      const previous = [process.env[productKey], process.env[groupKey]];
      const productId = '00000000-0000-4000-8000-000000000001';
      process.env[productKey] = productId;
      process.env[groupKey] = 'configured-group';
      try {
        const jobs = buildInitialMondayJobs(order, [line(productId)], {
          [`mondayReport${report.key}`]: { boardId: 'configured-board' },
        });
        assert.equal(jobs[`mondayReport${report.key}`]?.groupId, 'configured-group');
        assert.equal(jobs[`mondayReport${report.key}`]?.boardId, 'configured-board');
        assert.equal(buildReportPayload(order, [line(productId)], { productId }).orderNumber,
          `${order.number}:${report.slug}`);
      } finally {
        for (const [index, key] of [productKey, groupKey].entries()) {
          if (previous[index] === undefined) delete process.env[key];
          else process.env[key] = previous[index];
        }
      }
    }
  });

  it('rejects invalid data and conflicting recipients and honors simulated-payment settings', () => {
    const report = MONDAY_REPORTS[0], productId = report.productId;
    const items = [line(productId)];
    assert.throws(() => buildReportPayload({ ...order, status: 'pending' }, items, { productId }), /not-paid/);
    assert.throws(() => buildReportPayload({ ...order, currency: 'USD' }, items, { productId }), /requires-mxn/);
    assert.throws(() => buildReportPayload(order, [], { productId }), /no-report/);
    assert.throws(() => buildReportPayload(order, items, { productId: 'unknown' }), /unknown-monday-report/);
    assert.throws(() => buildReportPayload(order, [{ ...items[0], quantity: 0 }], { productId }), /quantity/);
    assert.throws(() => buildReportPayload({ ...order, customerBirthDate: '1990-02-31' }, items, { productId }), /birth-date/);
    const conflicting = ['Persona Uno', 'Persona Dos'].map((name) => ({ ...line(productId), metadata: {
      reports: [{ key: report.reportKey, person: { name, birthDate: '1990-01-01' } }],
    } }));
    assert.throws(() => buildReportPayload(order, conflicting, { productId }), /multiple-report-recipients/);
    const simulated = { ...order, externalPaymentIntentId: 'SIMULADO-test' };
    assert.equal(buildInitialMondayJobs(simulated, items).mondayReportWhoAmI?.status, 'skipped');
    assert.equal(buildInitialMondayJobs(simulated, items, {
      mondayReportWhoAmI: { syncTestOrders: true },
    }).mondayReportWhoAmI?.status, 'pending');
  });

  it('keeps reports in their groups and recovers a lost response without duplicating a purchase', async () => {
    const items = MONDAY_REPORTS.map((r) => line(r.productId));
    const jobs = buildInitialMondayJobs(order, items) as Record<string, MondayJob>;
    const remote = new Map<string, string>();
    const keys = new Set<string>();
    let lostResponse = true, mutations = 0;
    const client = createMondayClient('test-token', async (_url, init) => {
      const { query, variables } = JSON.parse(String(init?.body));
      if (query.includes('query PurchaseOrder')) {
        assert.equal(variables.orderColumn, REPORTS_ORDER_COLUMN);
        const itemId = remote.get(variables.orderNumber);
        return Response.json({ data: { boards: [{ id: REPORTS_BOARD_ID, columns: [] }],
          items_page_by_column_values: { items: itemId ? [{ id: itemId,
            column_values: [{ id: REPORTS_ORDER_COLUMN, text: variables.orderNumber }] }] : [] } } });
      }
      mutations++;
      const columns = JSON.parse(variables.columns);
      const report = MONDAY_REPORTS.find((r) => columns.texto === reportOrderReference(order.number, r.productId))!;
      assert.ok(report);
      assert.equal(variables.boardId, REPORTS_BOARD_ID);
      assert.equal(variables.groupId, report.groupId);
      const key = (init?.headers as Record<string, string>)['Idempotency-Key'];
      assert.equal(key, `tienda-nume:report:${REPORTS_BOARD_ID}:${order.id}:${report.productId}`);
      keys.add(key);
      remote.set(columns.texto, `item-${report.key}`);
      if (lostResponse) { lostResponse = false; throw new Error('lost-response'); }
      return Response.json({ data: { create_item: { id: `item-${report.key}` } } });
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
    assert.equal(jobs.mondayReportWhoAmI.status, 'failed');
    jobs.mondayReportWhoAmI.nextAttemptAt = new Date(0).toISOString();
    for (const key of Object.keys(jobs)) await deliverMondayOrder(order.id, store(key), client);
    assert.ok(Object.values(jobs).every((job) => job.status === 'sent'));
    assert.equal(remote.size, MONDAY_REPORTS.length);
    assert.equal(keys.size, MONDAY_REPORTS.length);
    assert.equal(mutations, MONDAY_REPORTS.length);
  });
});
