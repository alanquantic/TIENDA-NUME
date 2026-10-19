import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PHYSICAL_MAX_PER_ORDER, effectiveMaxPerOrder } from '../lib/order-limits';

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
});
