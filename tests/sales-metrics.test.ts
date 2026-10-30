import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chartTrend, parseMetricsFilters } from '../lib/admin/sales-metrics';

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

  it('expands a month and lets it win over the date range', () => {
    const filters = parseMetricsFilters({ mes: '2024-02', desde: '2023-01-01', hasta: '2023-01-02' }, 'MXN');
    assert.equal(filters.from, '2024-02-01');
    assert.equal(filters.to, '2024-02-29');
    assert.equal(filters.error, null);
  });

  it('rejects invalid, inverted, duplicate and excessive ranges', () => {
    for (const params of [
      { desde: '2026-02-30', hasta: '2026-03-01' },
      { desde: '2026-02-02', hasta: '2026-02-01' },
      { desde: '', hasta: '2026-02-01' },
      { desde: '2024-01-01', hasta: '2026-01-01' },
      { desde: ['2026-01-01'] }, { moneda: 'INVALID' }, { tipo: 'invalid' }, { mes: '2026-13' },
    ]) assert.ok(parseMetricsFilters(params, 'MXN').error);
  });
});

describe('sales metrics trend', () => {
  const day = (date: string, revenue = 0, orders = 0) => ({ day: date, revenue, orders });

  it('groups long periods by month without changing totals', () => {
    const points = [];
    for (let date = new Date('2026-01-01T12:00:00Z'); date <= new Date('2026-03-31T12:00:00Z'); date.setUTCDate(date.getUTCDate() + 1)) {
      const key = date.toISOString().slice(0, 10);
      points.push(day(key, key === '2026-01-31' ? 12345 : key === '2026-02-01' ? 5000 : 0, key === '2026-01-31' ? 2 : 0));
    }
    const grouped = chartTrend(points);
    assert.equal(grouped.monthly, true);
    assert.equal(grouped.points.length, 3);
    assert.equal(grouped.points[0].revenue, 12345);
    assert.equal(grouped.points[0].orders, 2);
    assert.equal(grouped.points[1].revenue, 5000);
    assert.equal(grouped.points[2].revenue, 0);
  });

  it('keeps daily points for periods up to 62 days', () => {
    const points = Array.from({ length: 31 }, (_, i) => day(`2026-01-${String(i + 1).padStart(2, '0')}`));
    assert.equal(chartTrend(points).monthly, false);
    assert.equal(chartTrend(points).points.length, 31);
  });
});
