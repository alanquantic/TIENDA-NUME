import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toMetaEvent } from '../lib/analytics/meta-pixel';

const agenda = {
  item_id: 'variante-morada',
  item_name: 'Agenda Numerológica 2027 Preventa',
  item_variant: 'Morada',
  item_category: 'physical',
  price: 890,
  quantity: 1,
  currency: 'MXN',
};

describe('toMetaEvent', () => {
  it('convierte view_item en ViewContent con el producto', () => {
    const meta = toMetaEvent({
      event: 'view_item',
      params: { currency: 'MXN', value: 890, items: [agenda] },
    });
    assert.deepEqual(meta, {
      name: 'ViewContent',
      params: {
        currency: 'MXN',
        value: 890,
        content_type: 'product',
        content_ids: ['variante-morada'],
        contents: [{ id: 'variante-morada', quantity: 1, item_price: 890 }],
        num_items: 1,
        content_name: 'Agenda Numerológica 2027 Preventa',
        content_category: 'physical',
      },
    });
  });

  it('mapea el embudo de compra a los eventos estándar de Meta', () => {
    const params = { currency: 'MXN', value: 1780, items: [{ ...agenda, quantity: 2 }] };
    assert.equal(toMetaEvent({ event: 'add_to_cart', params })?.name, 'AddToCart');
    assert.equal(toMetaEvent({ event: 'begin_checkout', params })?.name, 'InitiateCheckout');
    assert.equal(toMetaEvent({ event: 'add_payment_info', params })?.name, 'AddPaymentInfo');
    assert.equal(toMetaEvent({ event: 'add_to_cart', params })?.params.num_items, 2);
  });

  it('manda Purchase con un eventID estable por pedido', () => {
    const meta = toMetaEvent({
      event: 'purchase',
      params: { transaction_id: 'TN-1042', currency: 'MXN', value: 890, items: [agenda] },
    });
    assert.equal(meta?.name, 'Purchase');
    assert.equal(meta?.eventId, 'purchase-TN-1042');
    assert.equal(meta?.params.value, 890);
  });

  it('ignora los eventos sin equivalente en Meta', () => {
    assert.equal(toMetaEvent({ event: 'view_cart', params: { currency: 'MXN', value: 0, items: [] } }), null);
    assert.equal(toMetaEvent({ event: 'view_item_list', params: { items: [agenda] } }), null);
  });
});
