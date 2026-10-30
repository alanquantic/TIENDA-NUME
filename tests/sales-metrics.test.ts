import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chartTrend, parseMetricsFilters, summarizeMetrics } from '../lib/admin/sales-metrics';

describe('sales metrics filters', () => {
  it('defaults to the current Mexico City month and real orders', () => {
    const filters = parseMetricsFilters({}, 'MXN', new Date('2026-11-01T05:59:59Z'));
    assert.equal(filters.from, '2026-10-01');
    assert.equal(filters.to, '2026-10-31');
    assert.equal(filters.kind, 'real');
    assert.equal(filters.currency, 'MXN');
    assert.equal(filters.error, null);
  });

  it('accepts leap days and an inclusive year of data', () => {
    assert.equal(parseMetricsFilters({ desde: '2024-01-01', hasta: '2024-12-31' }, 'MXN').error, null);
  });

  it('rejects invalid, inverted, duplicate and excessive ranges', () => {
    for (const params of [
      { desde: '2026-02-30', hasta: '2026-03-01' },
      { desde: '2026-02-02', hasta: '2026-02-01' },
      { desde: '', hasta: '2026-02-01' },
      { desde: '2024-01-01', hasta: '2026-01-01' },
      { desde: ['2026-01-01'] }, { moneda: 'INVALID' }, { tipo: 'invalid' },
    ]) assert.ok(parseMetricsFilters(params, 'MXN').error);
  });
});

describe('sales metrics calculations', () => {
  it('counts every order but only paid statuses contribute to gross revenue and ticket average', () => {
    const summary = summarizeMetrics([
      { day: '2026-10-01', status: 'paid', count: 2, commercialCount: 2, totalMinor: 10001 },
      { day: '2026-10-01', status: 'fulfilled', count: 1, commercialCount: 1, totalMinor: 20000 },
      { day: '2026-10-02', status: 'pending', count: 3, commercialCount: 3, totalMinor: 99999 },
      { day: '2026-10-02', status: 'cancelled', count: 1, commercialCount: 1, totalMinor: 99999 },
      { day: '2026-10-02', status: 'refunded', count: 1, commercialCount: 1, totalMinor: 5000 },
      { day: '2026-10-02', status: 'partially_refunded', count: 1, commercialCount: 1, totalMinor: 3000 },
    ], '2026-10-01', '2026-10-03');
    assert.equal(summary.totalOrders, 9);
    assert.equal(summary.paidOrders, 5);
    assert.equal(summary.grossMinor, 38001);
    assert.equal(summary.averageMinor, 7600);
    assert.equal(summary.refundedOrders, 2);
    assert.equal(summary.trend.length, 3);
    assert.deepEqual(summary.trend[2], { day: '2026-10-03', revenue: 0, orders: 0 });
    assert.equal(summary.trend.reduce((sum, day) => sum + day.revenue, 0), summary.grossMinor);
    assert.equal(summary.trend.reduce((sum, day) => sum + day.orders, 0), summary.totalOrders);
  });

  it('does not count out-of-period rows', () => {
    assert.equal(summarizeMetrics([{ day: '2026-09-30', status: 'paid', count: 1, commercialCount: 1, totalMinor: 999 }], '2026-10-01', '2026-10-01').totalOrders, 0);
  });

  it('handles no orders and zero-price paid orders without NaN', () => {
    const empty = summarizeMetrics([], '2026-10-01', '2026-10-01');
    assert.equal(empty.averageMinor, 0);
    assert.equal(empty.paidRate, 0);
    const free = summarizeMetrics([{ day: '2026-10-01', status: 'paid', count: 1, commercialCount: 0, totalMinor: 0 }], '2026-10-01', '2026-10-01');
    assert.equal(free.averageMinor, 0);
    assert.equal(free.paidOrders, 1);
    assert.equal(free.paidRate, 100);
  });

  it('groups long periods by month without changing totals', () => {
    const summary = summarizeMetrics([
      { day: '2026-01-31', status: 'paid', count: 2, commercialCount: 2, totalMinor: 12345 },
      { day: '2026-02-01', status: 'paid', count: 1, commercialCount: 1, totalMinor: 5000 },
    ], '2026-01-01', '2026-03-31');
    const grouped = chartTrend(summary.trend);
    assert.equal(grouped.monthly, true);
    assert.equal(grouped.points.length, 3);
    assert.equal(grouped.points[0].revenue, 12345);
    assert.equal(grouped.points[1].revenue, 5000);
    assert.equal(grouped.points[2].revenue, 0);
    assert.equal(chartTrend(summary.trend.slice(0, 31)).monthly, false);
  });
});


describe('commercial sales', () => {
  it('excludes free and test orders from the average while retaining overall counts', () => {
    const summary = summarizeMetrics([
      { day: '2026-10-01', status: 'paid', count: 5, commercialCount: 2, totalMinor: 30000 },
      { day: '2026-10-01', status: 'pending', count: 1, commercialCount: 1, totalMinor: 10000 },
    ], '2026-10-01', '2026-10-01');
    assert.equal(summary.totalOrders, 6);
    assert.equal(summary.paidOrders, 5);
    assert.equal(summary.commercialOrders, 2);
    assert.equal(summary.averageMinor, 15000);
    assert.equal(summary.grossMinor, 30000);
    assert.equal(summary.trend[0].orders, 6);
    assert.equal(summary.trend[0].revenue, 30000);
  });
  it('returns zero commercial metrics when all paid orders are excluded', () => {
    const summary = summarizeMetrics([
      { day: '2026-10-01', status: 'paid', count: 3, commercialCount: 0, totalMinor: 0 },
    ], '2026-10-01', '2026-10-01');
    assert.equal(summary.totalOrders, 3);
    assert.equal(summary.commercialOrders, 0);
    assert.equal(summary.averageMinor, 0);
    assert.equal(summary.grossMinor, 0);
  });
});
