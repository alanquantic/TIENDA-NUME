import assert from 'node:assert/strict';
import { it } from 'node:test';
import { selectCartRecommendations } from '../lib/cart-recommendations';

const product = (id: string, categorySlug: string | null, inStock = true) => ({ id, slug: id, categorySlug, inStock });
const catalog = [product('amor', 'reportes'), product('trabajo', 'reportes'), product('agenda', 'agendas'), product('agenda2', 'agendas'), product('curso', 'cursos'), product('plan', 'planes')];

it('excluye todos los productos y categorías del carrito', () => {
  assert.deepEqual(selectCartRecommendations(catalog, ['amor', 'curso']).map(p => p.id), ['agenda', 'plan']);
});
it('muestra una sola sugerencia por categoría', () => {
  assert.deepEqual(selectCartRecommendations(catalog, ['amor']).map(p => p.id), ['agenda', 'curso', 'plan']);
});
it('omite agotados y productos sin categoría y respeta el límite', () => {
  assert.deepEqual(selectCartRecommendations([product('agotado', 'otra', false), product('sin', null), ...catalog], ['amor'], 2).map(p => p.id), ['agenda', 'curso']);
});
it('no rellena con categorías del carrito cuando no hay alternativas', () => {
  assert.deepEqual(selectCartRecommendations(catalog, ['amor', 'agenda', 'curso', 'plan']), []);
  assert.deepEqual(selectCartRecommendations(catalog, []), []);
});
it('recalcula las alternativas al añadir o retirar un producto', () => {
  assert.ok(selectCartRecommendations(catalog, ['amor']).some(p => p.id === 'curso'));
  assert.ok(!selectCartRecommendations(catalog, ['amor', 'curso']).some(p => p.id === 'curso'));
});
