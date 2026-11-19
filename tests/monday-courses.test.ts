import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  COURSES_BOARD_ID, COURSES_ORDER_COLUMN, MONDAY_COURSES,
  buildCoursePayload, courseOrderReference,
} from '../lib/monday/courses';
import { buildInitialMondayJobs } from '../lib/monday/jobs';
import { createMondayClient } from '../lib/monday/client';
import { deliverMondayOrder, mondayJobDue, type MondayDeliveryStore } from '../lib/monday/delivery';
import type { MondayOrder, MondayItem, MondayJob } from '../lib/monday/shared';

const order: MondayOrder = {
  id: 'courses-order', number: 'NUME-COURSES', status: 'paid', paidAt: new Date('2026-11-18T02:00:00Z'),
  currency: 'MXN', customerFirstName: 'Ana María', customerLastName: 'De la Cruz López',
  customerBirthDate: '1990-08-21', customerEmail: 'cliente@example.test', customerPhone: '5512345678',
  shippingAddress: null, totalAmount: '900.00', shippingAmount: '0.00',
  metadata: {}, externalPaymentIntentId: 'payment-test', provider: 'paypal',
};
const line = (productId: string): MondayItem => ({
  productId, variantName: 'Default', quantity: 1, totalAmount: '100.00',
});

describe('Cursos y certificaciones: grupos por producto', () => {
  it('routes every known course to its own group with independent jobs', () => {
    for (const course of MONDAY_COURSES) {
      const jobs = buildInitialMondayJobs(order, [line(course.productId)]);
      assert.deepEqual(Object.keys(jobs), [`mondayCourse${course.key}`]);
      const job = jobs[`mondayCourse${course.key}`]!;
      assert.equal(job.kind, 'course');
      assert.equal(job.boardId, COURSES_BOARD_ID);
      assert.equal(job.groupId, course.groupId);
      assert.equal(job.productId, course.productId);
      assert.deepEqual(buildCoursePayload(order, [line(course.productId)], {
        productId: course.productId,
      }).columns.status9, { index: 1 });
    }
    assert.equal(MONDAY_COURSES.find((c) => c.key === 'Module1')?.groupId, 'new_group78717');
    assert.equal(MONDAY_COURSES.find((c) => c.key === 'NameWorkshop')?.groupId, 'new_group67099');
    assert.deepEqual(buildInitialMondayJobs(order, [line('unrelated')]), {});
    // COMBO Niveles 1–4: excluido por indicación del usuario.
    assert.deepEqual(buildInitialMondayJobs(order, [line('02a674f5-1006-4ccf-b251-b6ab32f08309')]), {});
  });

  it('sends buyer, birthday, purchase date and payment options specific to this board', () => {
    const productId = MONDAY_COURSES[0].productId;
    const payload = buildCoursePayload(order, [line(productId)], { productId });
    assert.equal(payload.name, 'Ana María');
    assert.equal(payload.columns.texto0, 'De la Cruz López');
    assert.ok(!('texto5' in payload.columns));
    assert.ok(!('mm' in payload.columns)); // Este tablero no tiene VENDEDOR.
    assert.ok(!('pago_1' in payload.columns));
    assert.equal(payload.columns.texto33, order.customerEmail);
    assert.deepEqual(payload.columns.phone1, { phone: order.customerPhone, countryShortName: 'MX' });
    assert.deepEqual(payload.columns.date_mkq01sah, { date: '2026-11-17' });
    assert.equal(payload.columns.texto3, 21);
    assert.deepEqual(payload.columns.texto92, { ids: [8] });
    assert.equal(payload.columns.texto1, 1990);
    assert.equal(payload.columns.texto, courseOrderReference(order.number, productId));
    for (const [provider, index] of [['paypal', 2], ['mercadopago', 10], ['stripe', 108]] as const) {
      assert.deepEqual(buildCoursePayload({ ...order, provider }, [line(productId)], { productId }).columns.status2,
        { index });
    }
  });

  it('distributes paid amounts after discounts without charging other items or shipping to courses', () => {
    const courses = MONDAY_COURSES.slice(0, 2);
    const items = [...courses.map((c) => line(c.productId)), { ...line('other'), totalAmount: '200.00' }];
    const paid = { ...order, totalAmount: '370.00', shippingAmount: '10.00' };
    for (const course of courses) {
      const columns = buildCoursePayload(paid, items, { productId: course.productId }).columns;
      assert.equal(columns.numbers1, '90.00');
      assert.equal(columns.n_meros, '90.00');
    }
  });

  it('uses per-product environment settings for the product and group', () => {
    for (const course of MONDAY_COURSES) {
      const productKey = `MONDAY_COURSES_${course.envKey}_PRODUCT_ID`;
      const groupKey = `MONDAY_COURSES_${course.envKey}_GROUP_ID`;
      const previous = [process.env[productKey], process.env[groupKey]];
      const productId = '00000000-0000-4000-8000-000000000001';
      process.env[productKey] = productId;
      process.env[groupKey] = 'configured-group';
      try {
        const jobs = buildInitialMondayJobs(order, [line(productId)], {
          [`mondayCourse${course.key}`]: { boardId: 'configured-board' },
        });
        assert.equal(jobs[`mondayCourse${course.key}`]?.groupId, 'configured-group');
        assert.equal(jobs[`mondayCourse${course.key}`]?.boardId, 'configured-board');
        assert.equal(jobs[`mondayCourse${course.key}`]?.productId, productId);
        assert.equal(buildCoursePayload(order, [line(productId)], { productId }).orderNumber,
          `${order.number}:${course.slug}`);
      } finally {
        for (const [index, key] of [productKey, groupKey].entries()) {
          if (previous[index] === undefined) delete process.env[key];
          else process.env[key] = previous[index];
        }
      }
    }
  });

  it('applies a configured status and refuses invalid status indices', () => {
    const previous = process.env.MONDAY_COURSES_STATUS_INDEX;
    const productId = MONDAY_COURSES[1].productId;
    try {
      process.env.MONDAY_COURSES_STATUS_INDEX = '1';
      assert.deepEqual(buildCoursePayload(order, [line(productId)], { productId }).columns.status9, { index: 1 });
      process.env.MONDAY_COURSES_STATUS_INDEX = '';
      assert.ok(!('status9' in buildCoursePayload(order, [line(productId)], { productId }).columns));
      process.env.MONDAY_COURSES_STATUS_INDEX = '999';
      assert.throws(() => buildCoursePayload(order, [line(productId)], { productId }), /invalid-course-status/);
    } finally {
      if (previous === undefined) delete process.env.MONDAY_COURSES_STATUS_INDEX;
      else process.env.MONDAY_COURSES_STATUS_INDEX = previous;
    }
  });

  it('rejects invalid paid-order data and honors the simulated-payment setting', () => {
    const productId = MONDAY_COURSES[1].productId;
    const items = [line(productId)];
    assert.throws(() => buildCoursePayload({ ...order, status: 'pending' }, items, { productId }), /not-paid/);
    assert.throws(() => buildCoursePayload({ ...order, currency: 'USD' }, items, { productId }), /requires-mxn/);
    assert.throws(() => buildCoursePayload(order, [], { productId }), /no-course/);
    assert.throws(() => buildCoursePayload(order, items, { productId: 'unknown' }), /unknown-monday-course/);
    assert.throws(() => buildCoursePayload(order, [{ ...items[0], quantity: 0 }], { productId }), /quantity/);
    assert.throws(() => buildCoursePayload({ ...order, customerBirthDate: '1990-02-31' }, items, { productId }), /birth-date/);
    const absent = buildCoursePayload({ ...order, customerBirthDate: null }, items, { productId }).columns;
    for (const key of ['texto3', 'texto92', 'texto1']) assert.ok(!(key in absent));
    const simulated = { ...order, externalPaymentIntentId: 'SIMULADO-test' };
    assert.equal(buildInitialMondayJobs(simulated, items).mondayCourseModule1?.status, 'skipped');
    assert.equal(buildInitialMondayJobs(simulated, items, {
      mondayCourseModule1: { syncTestOrders: true },
    }).mondayCourseModule1?.status, 'pending');
  });

  it('recovers a lost response and registers multiple courses without mixing groups or duplicating items', async () => {
    const items = MONDAY_COURSES.map((c) => line(c.productId));
    const jobs = buildInitialMondayJobs(order, items) as Record<string, MondayJob>;
    const remote = new Map<string, string>();
    const keys = new Set<string>();
    let lostResponse = true;
    let mutations = 0;
    const client = createMondayClient('test-token', async (_url, init) => {
      const { query, variables } = JSON.parse(String(init?.body));
      if (query.includes('query PurchaseOrder')) {
        assert.equal(variables.orderColumn, COURSES_ORDER_COLUMN);
        const itemId = remote.get(variables.orderNumber);
        return Response.json({ data: { boards: [{ id: COURSES_BOARD_ID, columns: [] }],
          items_page_by_column_values: { items: itemId ? [{ id: itemId,
            column_values: [{ id: COURSES_ORDER_COLUMN, text: variables.orderNumber }] }] : [] } } });
      }
      mutations++;
      const columns = JSON.parse(variables.columns);
      const course = MONDAY_COURSES.find((c) => columns.texto === courseOrderReference(order.number, c.productId))!;
      assert.ok(course);
      assert.equal(variables.boardId, COURSES_BOARD_ID);
      assert.equal(variables.groupId, course.groupId);
      const key = (init?.headers as Record<string, string>)['Idempotency-Key'];
      assert.equal(key, `tienda-nume:course:${COURSES_BOARD_ID}:${order.id}:${course.productId}`);
      keys.add(key);
      remote.set(columns.texto, `item-${course.key}`);
      if (lostResponse) { lostResponse = false; throw new Error('lost-response'); }
      return Response.json({ data: { create_item: { id: `item-${course.key}` } } });
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
    assert.equal(jobs.mondayCourseComplete.status, 'failed');
    jobs.mondayCourseComplete.nextAttemptAt = new Date(0).toISOString();
    for (const key of Object.keys(jobs)) await deliverMondayOrder(order.id, store(key), client);
    assert.ok(Object.values(jobs).every((job) => job.status === 'sent'));
    assert.equal(remote.size, MONDAY_COURSES.length);
    assert.equal(keys.size, MONDAY_COURSES.length);
    assert.equal(mutations, MONDAY_COURSES.length);
  });
});
