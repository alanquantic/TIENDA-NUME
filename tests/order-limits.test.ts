import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AGENDA_2027_PRODUCT_ID, PHYSICAL_MAX_PER_ORDER, effectiveMaxPerOrder } from '../lib/order-limits';
import { itemCap, type CartItem } from '../lib/cart-store';

describe('effectiveMaxPerOrder', () => {
  it('limita los físicos a 1 aunque la BD no tenga tope', () => {
    assert.equal(PHYSICAL_MAX_PER_ORDER, 1);
    assert.equal(effectiveMaxPerOrder('physical', null), 1);
    assert.equal(effectiveMaxPerOrder('physical', undefined), 1);
  });

  it('limita los físicos a 1 aunque la BD permita más', () => {
    assert.equal(effectiveMaxPerOrder('physical', 5), 1);
    assert.equal(effectiveMaxPerOrder('physical', 1), 1);
  });

  it('no cambia el tope de los digitales', () => {
    assert.equal(effectiveMaxPerOrder('digital', null), null);
    assert.equal(effectiveMaxPerOrder('digital', 3), 3);
  });

  it('permite 2 Agendas 2027 por pedido', () => {
    assert.equal(effectiveMaxPerOrder('physical', null, AGENDA_2027_PRODUCT_ID), 2);
    assert.equal(effectiveMaxPerOrder('physical', 5, AGENDA_2027_PRODUCT_ID), 2);
    // El admin puede bajarlo, no subirlo.
    assert.equal(effectiveMaxPerOrder('physical', 1, AGENDA_2027_PRODUCT_ID), 1);
    assert.equal(effectiveMaxPerOrder('physical', null, 'otro-producto'), 1);
  });
});

describe('itemCap', () => {
  const agenda = (variantId: string, quantity: number): CartItem => ({
    variantId, productId: AGENDA_2027_PRODUCT_ID, slug: 'agenda-numerologica-2027', name: 'Agenda 2027',
    variantName: variantId, priceAmount: '100.00', currency: 'MXN', image: null, type: 'physical',
    quantity, maxStock: null, maxPerOrder: 2,
  });

  it('cuenta el tope por producto, sumando variantes', () => {
    const morada = agenda('morada', 1);
    const amarilla = agenda('amarilla', 1);
    assert.equal(itemCap(morada), 2);
    assert.equal(itemCap(amarilla, [morada]), 1);
    assert.equal(itemCap(amarilla, [{ ...morada, quantity: 2 }]), 0);
    assert.equal(itemCap(morada, [morada, amarilla]), 1);
  });
});
