import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PgDialect } from 'drizzle-orm/pg-core';
import { assertCouponEmailLimit } from '../lib/coupon-usage';
import { adminCouponSchema } from '../lib/validation';

describe('coupon email limits', () => {
  const coupon = { code: 'TEST100', maxRedemptionsPerEmail: 2 };
  function connection(count: number) {
    let query: { sql: string; params: unknown[] } | undefined;
    const database = { select: () => ({ from: () => ({ where: async (condition: Parameters<PgDialect['sqlToQuery']>[0]) => {
      query = new PgDialect().sqlToQuery(condition);
      return [{ count }];
    } }) }) } as unknown as Parameters<typeof assertCouponEmailLimit>[0];
    return { database, query: () => query };
  }

  it('does not query usage for unlimited coupons', async () => {
    const mock = connection(100);
    await assertCouponEmailLimit(mock.database, { ...coupon, maxRedemptionsPerEmail: null });
    assert.equal(mock.query(), undefined);
  });

  it('requires an email for limited coupons', async () => {
    await assert.rejects(assertCouponEmailLimit(connection(0).database, coupon, '  '), /Ingresa tu correo/);
  });

  it('allows remaining uses and normalizes email when querying historical orders', async () => {
    const mock = connection(1);
    await assertCouponEmailLimit(mock.database, coupon, '  USER@Example.com ');
    assert.deepEqual(mock.query()?.params, ['TEST100', 'user@example.com', 'cancelled']);
    assert.match(mock.query()!.sql, /lower\(trim\(/);
    assert.match(mock.query()!.sql, /paid_at.*is not null/);
  });

  it('rejects usage at and above the maximum', async () => {
    for (const count of [2, 3]) {
      await assert.rejects(assertCouponEmailLimit(connection(count).database, coupon, 'user@example.com'), /máximo de usos/);
    }
  });

  it('validates positive integers and preserves unlimited defaults', () => {
    const input = { code: 'TEST', type: 'percent', value: '100' };
    for (const value of [null, undefined, 1, 3]) {
      assert.equal(adminCouponSchema.safeParse({ ...input, maxRedemptionsPerEmail: value }).success, true);
    }
    for (const value of [0, -1, 1.5, '1', 2147483648]) {
      assert.equal(adminCouponSchema.safeParse({ ...input, maxRedemptionsPerEmail: value }).success, false);
    }
  });
});
