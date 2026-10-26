import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseCategoryFilter, parseOrderFilters } from '../lib/admin/order-filters';

describe('filtro de categoría del admin', () => {
  it('acepta un id, "sin" o vacío', () => {
    const id = '0b6f6a2e-4a4b-4a8e-9a7f-1d2c3b4a5e6f';
    assert.deepEqual(parseCategoryFilter({ categoria: id }), { categoryId: id, error: null });
    assert.deepEqual(parseCategoryFilter({ categoria: 'sin' }), { categoryId: 'sin', error: null });
    assert.deepEqual(parseCategoryFilter({}), { categoryId: '', error: null });
  });

  it('rechaza valores inventados y lo reporta en los pedidos', () => {
    assert.equal(parseCategoryFilter({ categoria: "x' OR 1=1" }).error, 'Selecciona una categoría válida.');
    assert.equal(parseOrderFilters({ categoria: 'nope' }).error, 'Selecciona una categoría válida.');
  });
});
