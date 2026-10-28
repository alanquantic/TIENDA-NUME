import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { monthRange, orderFiltersQuery, parseOrderFilters } from '../lib/admin/order-filters';
import { isTestOrder, itemKind } from '../lib/admin/order-kinds';

describe('filtros de pedidos: mes y tipo', () => {
  it('el mes se vuelve rango completo, con años bisiestos', () => {
    assert.deepEqual(monthRange('2026-10'), { from: '2026-10-01', to: '2026-10-31' });
    assert.deepEqual(monthRange('2028-02'), { from: '2028-02-01', to: '2028-02-29' });
    assert.equal(monthRange('2026-13'), null);
    assert.equal(monthRange('oct'), null);
  });

  it('el mes manda sobre Desde/Hasta', () => {
    const f = parseOrderFilters({ mes: '2026-09', desde: '2026-01-01', hasta: '2026-12-31' });
    assert.equal(f.error, null);
    assert.equal(f.from, '2026-09-01');
    assert.equal(f.to, '2026-09-30');
    assert.equal(orderFiltersQuery(f), 'mes=2026-09');
  });

  it('valida mes y tipo', () => {
    assert.equal(parseOrderFilters({ mes: '2026-99' }).error, 'Selecciona un mes válido.');
    assert.equal(parseOrderFilters({ tipo: 'otros' }).error, 'Selecciona un tipo de pedido válido.');
    assert.equal(parseOrderFilters({ tipo: 'pruebas' }).kind, 'pruebas');
  });
});

describe('pedidos de prueba', () => {
  const base = { metadata: {}, externalPaymentIntentId: null, discountCode: null, totalAmount: '450.00' };

  it('sandbox o simulado', () => {
    assert.equal(isTestOrder({ ...base, metadata: { paymentMode: 'sandbox' } }), true);
    assert.equal(isTestOrder({ ...base, externalPaymentIntentId: 'SIMULADO-123' }), true);
    assert.equal(isTestOrder({ ...base, metadata: { paymentMode: 'production' } }), false);
  });

  it('cupón TEST/PRUEBA solo si deja el total en 0', () => {
    assert.equal(isTestOrder({ ...base, discountCode: 'PRUEBA100', totalAmount: '0.00' }), true);
    assert.equal(isTestOrder({ ...base, discountCode: 'test-equipo', totalAmount: '0' }), true);
    assert.equal(isTestOrder({ ...base, discountCode: 'TEST10', totalAmount: '405.00' }), false);
    assert.equal(isTestOrder({ ...base, discountCode: 'BIENVENIDA', totalAmount: '0.00' }), false);
  });
});

describe('tipo de ítem', () => {
  it('membresías, licencias y certificaciones', () => {
    assert.equal(itemKind({ slug: 'membresia-180', categorySlug: null, type: 'digital' }), 'membership');
    assert.equal(itemKind({ slug: 'licencia-software-arithmax-1-ano', categorySlug: null, type: 'digital' }), 'license');
    assert.equal(itemKind({ slug: 'x', categorySlug: 'certificaciones', type: 'digital' }), 'certification');
  });

  it('reportes IA por catálogo o por el motor del reporte generado', () => {
    assert.equal(itemKind({ slug: 'quien-soy', categorySlug: null, type: 'digital' }), 'ai-report');
    assert.equal(itemKind({ slug: 'renombrado', categorySlug: null, type: 'digital', reportEngines: ['ai'] }), 'ai-report');
    assert.equal(itemKind({ slug: 'renombrado', categorySlug: null, type: 'digital', reportEngines: ['legacy'] }), 'report');
  });

  it('sin grupo ni reporte: digital o físico', () => {
    assert.equal(itemKind({ slug: null, categorySlug: null, type: 'physical' }), 'physical');
    assert.equal(itemKind({ slug: 'otro', categorySlug: null, type: 'digital' }), 'digital');
  });
});
