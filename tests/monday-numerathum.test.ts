import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AGENDA_2027_PRODUCT_ID, MONDAY_JOB_KEY, buildAgenda2027Payload } from '../lib/monday/agenda-2027';
import { buildInitialMondayJobs } from '../lib/monday/jobs';
import {
  NUMERATHUM_PRODUCT_ID, NUMERATHUM_BOARD_ID, NUMERATHUM_GROUP_ID, NUMERATHUM_JOB_KEY,
  NUMERATHUM_ORDER_COLUMN, buildNumerathumPayload,
} from '../lib/monday/numerathum';
import { createMondayClient, type MondayClient } from '../lib/monday/client';
import { deliverMondayOrder, mondayJobDue, type MondayDeliveryStore } from '../lib/monday/delivery';
import type { MondayOrder, MondayItem, MondayJob } from '../lib/monday/shared';

function order(overrides: Partial<MondayOrder> = {}): MondayOrder {
  return {
    id: 'mixed-order', number: 'NUME-MIXED', status: 'paid', paidAt: new Date('2026-10-17T02:00:00Z'),
    currency: 'MXN', customerFirstName: 'María José', customerLastName: 'De la Cruz López',
    customerBirthDate: '1990-08-21', customerEmail: 'cliente@example.test', customerPhone: '5512345678',
    shippingAddress: { country: 'MX' }, totalAmount: '3097.00', shippingAmount: '199.00',
    metadata: { paymentMode: 'production' }, externalPaymentIntentId: 'payment-123', provider: 'paypal',
    ...overrides,
  };
}
const agenda: MondayItem = { productId: AGENDA_2027_PRODUCT_ID, variantName: 'Morada', quantity: 1, totalAmount: '999.00' };
const numerathum: MondayItem = { productId: NUMERATHUM_PRODUCT_ID, variantName: 'Default', quantity: 1, totalAmount: '1899.00' };
const items = () => [agenda, numerathum];

describe('Numerathum board mapping', () => {
  it('selects ALAN with dropdown ID 27 and PLAN ORACULO with status index 0', () => {
    const payload = buildNumerathumPayload(order(), items());
    assert.equal(payload.name, 'María José');
    assert.deepEqual(payload.columns.mm, { ids: [27] });
    assert.deepEqual(payload.columns.color_mkxpqbfg, { index: 0 });
    assert.equal(payload.columns[NUMERATHUM_ORDER_COLUMN], 'NUME-MIXED');
    assert.equal(payload.columns.texto33, 'cliente@example.test');
    assert.deepEqual(payload.columns.phone1, { phone: '5512345678', countryShortName: 'MX' });
    assert.deepEqual(payload.columns.status2, { index: 2 });
  });

  it('maps birth day/month/year separately, independently of the purchase date', () => {
    const payload = buildNumerathumPayload(order(), items());
    assert.equal(payload.columns.texto3, 21);
    assert.deepEqual(payload.columns.texto92, { ids: [8] });
    assert.equal(payload.columns.texto1, 1990);
    assert.deepEqual(payload.columns.date_mkxpn5yf, { date: '2026-10-16' });
  });

  it('does not guess where compound surnames split', () => {
    const payload = buildNumerathumPayload(order(), items());
    assert.equal(payload.columns.texto0, 'De la Cruz López');
    assert.ok(!('texto5' in payload.columns));
  });

  it('keeps absent birthdays empty and rejects impossible dates', () => {
    const payload = buildNumerathumPayload(order({ customerBirthDate: null }), items());
    for (const id of ['texto3', 'texto92', 'texto1']) assert.ok(!(id in payload.columns));
    assert.throws(() => buildNumerathumPayload(order({ customerBirthDate: '1990-02-31' }), items()), /birth-date/);
    assert.equal(buildNumerathumPayload(order({ customerBirthDate: '2000-02-29' }), items()).columns.texto3, 29);
  });

  it('sends only the Numerathum amount and excludes Agenda 2027 and shipping', () => {
    const columns = buildNumerathumPayload(order(), items()).columns;
    assert.equal(columns.numbers1, '1899.00');
    assert.equal(columns.n_meros, '1899.00');
    for (const id of ['pago', 'pago_1', 'files1', 'verificar', 'numbers_2', 'numbers_3']) assert.ok(!(id in columns));
    assert.equal(buildAgenda2027Payload(order(), items()).columns.numbers, '999.00');
  });

  it('allocates a mixed-cart discount once across both boards, preserving the net total', () => {
    const discounted = order({ totalAmount: '2807.20' });
    const agendaAmount = Number(buildAgenda2027Payload(discounted, items()).columns.numbers);
    const numerathumAmount = Number(buildNumerathumPayload(discounted, items()).columns.n_meros);
    assert.equal(Math.round((agendaAmount + numerathumAmount) * 100), 260820);
    assert.equal(numerathumAmount, 1709.10);
  });

  it('does not send unrelated products or unpaid orders', () => {
    assert.throws(() => buildNumerathumPayload(order(), [agenda]), /no-numerathum/);
    assert.throws(() => buildNumerathumPayload(order({ status: 'pending' }), items()), /not-paid/);
  });
});

describe('independent board jobs', () => {
  it('queues one job per included product, even when bought alone', () => {
    const both = buildInitialMondayJobs(order(), items());
    assert.equal(both[MONDAY_JOB_KEY]?.boardId, '18434858318');
    assert.equal(both[NUMERATHUM_JOB_KEY]?.boardId, NUMERATHUM_BOARD_ID);
    assert.equal(both[NUMERATHUM_JOB_KEY]?.groupId, NUMERATHUM_GROUP_ID);
    assert.deepEqual(Object.keys(buildInitialMondayJobs(order(), [numerathum])), [NUMERATHUM_JOB_KEY]);
    assert.deepEqual(Object.keys(buildInitialMondayJobs(order(), [agenda])), [MONDAY_JOB_KEY]);
    assert.deepEqual(buildInitialMondayJobs(order(), []), {});
  });

  it('applies simulation opt-in independently and retains both pending jobs when enabled', () => {
    const testOrder = order({ externalPaymentIntentId: 'SIMULADO-test' });
    const skipped = buildInitialMondayJobs(testOrder, items());
    assert.equal(skipped[MONDAY_JOB_KEY]?.status, 'skipped');
    assert.equal(skipped[NUMERATHUM_JOB_KEY]?.status, 'skipped');
    const enabled = buildInitialMondayJobs(testOrder, items(), {
      [MONDAY_JOB_KEY]: { syncTestOrders: true }, [NUMERATHUM_JOB_KEY]: { syncTestOrders: true },
    });
    assert.equal(enabled[MONDAY_JOB_KEY]?.status, 'pending');
    assert.equal(enabled[NUMERATHUM_JOB_KEY]?.status, 'pending');
  });

  it('does not duplicate Agenda 2027 when Numerathum fails and is retried', async () => {
    const jobs = buildInitialMondayJobs(order(), items()) as Record<string, MondayJob>;
    const counts: Record<string, number> = {};
    let failNumerathum = true;
    const client: MondayClient = {
      async inspectOrder(board, _number, column) {
        assert.equal(column, board === NUMERATHUM_BOARD_ID ? '__pedido_web' : 'texto');
        return { itemId: null, postalColumnType: 'phone' };
      },
      async createPurchaseItem(input) {
        counts[input.boardId] = (counts[input.boardId] ?? 0) + 1;
        if (input.boardId === NUMERATHUM_BOARD_ID && failNumerathum) throw new Error('offline');
        return `item-${input.boardId}`;
      },
    };
    function store(key: string): MondayDeliveryStore {
      return {
        async claim() {
          if (!mondayJobDue(jobs[key])) return null;
          jobs[key] = { ...jobs[key], status: 'processing', attempts: jobs[key].attempts + 1,
            claimId: `${key}-${jobs[key].attempts}`, startedAt: new Date().toISOString() };
          return { order: order(), items: items(), job: jobs[key] };
        },
        async finish(_order, claimId, job) { if (jobs[key].claimId === claimId) jobs[key] = job; },
      };
    }
    await Promise.all(Object.keys(jobs).map((key) => deliverMondayOrder('mixed-order', store(key), client)));
    assert.equal(jobs[MONDAY_JOB_KEY].status, 'sent');
    assert.equal(jobs[NUMERATHUM_JOB_KEY].status, 'failed');
    failNumerathum = false;
    jobs[NUMERATHUM_JOB_KEY].nextAttemptAt = new Date(0).toISOString();
    await Promise.all(Object.keys(jobs).map((key) => deliverMondayOrder('mixed-order', store(key), client)));
    assert.equal(jobs[NUMERATHUM_JOB_KEY].status, 'sent');
    assert.equal(counts['18434858318'], 1);
    assert.equal(counts[NUMERATHUM_BOARD_ID], 2);
    assert.notEqual(jobs[MONDAY_JOB_KEY].itemId, jobs[NUMERATHUM_JOB_KEY].itemId);
  });
});

describe('Numerathum duplicate checks and mutation variables', () => {
  it('queries its own # PEDIDO WEB column', async () => {
    const client = createMondayClient('test-token', async (_url, init) => {
      const request = JSON.parse(String(init?.body));
      assert.equal(request.variables.orderColumn, '__pedido_web');
      return Response.json({ data: { boards: [{ id: NUMERATHUM_BOARD_ID, columns: [] }],
        items_page_by_column_values: { items: [{ id: 'existing', column_values: [{ id: '__pedido_web', text: 'NUME-MIXED' }] }] } } });
    });
    assert.equal((await client.inspectOrder(NUMERATHUM_BOARD_ID, 'NUME-MIXED', NUMERATHUM_ORDER_COLUMN)).itemId, 'existing');
  });

  it('uses a separate stable idempotency key and the provided Numerathum group', async () => {
    const client = createMondayClient('test-token', async (_url, init) => {
      const request = JSON.parse(String(init?.body));
      assert.equal(request.variables.groupId, NUMERATHUM_GROUP_ID);
      assert.equal(JSON.parse(request.variables.columns).__pedido_web, 'NUME-MIXED');
      assert.equal((init?.headers as Record<string, string>)['Idempotency-Key'], `tienda-nume:numerathum:${NUMERATHUM_BOARD_ID}:mixed-order`);
      return Response.json({ data: { create_item: { id: 'numerathum-item' } } });
    });
    assert.equal(await client.createPurchaseItem({ boardId: NUMERATHUM_BOARD_ID, groupId: NUMERATHUM_GROUP_ID,
      orderId: 'mixed-order', kind: 'numerathum', payload: buildNumerathumPayload(order(), items()) }), 'numerathum-item');
  });
});
