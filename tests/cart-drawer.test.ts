import assert from 'node:assert/strict';
import { beforeEach, it } from 'node:test';
import { useCart, type CartItem } from '../lib/cart-store';
import { useCartDrawer } from '../lib/cart-drawer-store';

const product: Omit<CartItem, 'quantity'> = {
  variantId: 'variant-a', productId: 'product-a', slug: 'product-a',
  name: 'Producto A', variantName: null, priceAmount: '100.00',
  currency: 'MXN', image: null, type: 'digital', maxStock: null, maxPerOrder: null,
};

beforeEach(() => {
  useCart.getState().clear();
  useCartDrawer.getState().close();
});

it('abre el panel al agregar y conserva los límites de cantidad', () => {
  useCart.getState().add({ ...product, maxPerOrder: 2 }, 3);
  assert.equal(useCartDrawer.getState().isOpen, true);
  assert.equal(useCart.getState().items[0].quantity, 2);
  useCartDrawer.getState().close();
  useCart.getState().add({ ...product, maxPerOrder: 2 });
  assert.equal(useCartDrawer.getState().isOpen, true);
  assert.equal(useCart.getState().items[0].quantity, 2);
});

it('abrir y cerrar el panel no modifica el carrito', () => {
  useCart.getState().add(product);
  useCartDrawer.getState().close();
  assert.equal(useCartDrawer.getState().isOpen, false);
  assert.equal(useCart.getState().items.length, 1);
  useCartDrawer.getState().open();
  assert.equal(useCart.getState().items.length, 1);
});

it('conserva altas y cantidades nuevas durante la validación del catálogo', async (t) => {
  useCart.getState().add(product);
  let respond!: (response: Response) => void;
  t.mock.method(globalThis, 'fetch', () => new Promise<Response>((resolve) => { respond = resolve; }));
  const pending = useCart.getState().reconcile();
  useCart.getState().setQuantity(product.variantId, 3);
  useCart.getState().add({ ...product, variantId: 'variant-b', productId: 'product-b' });
  respond(Response.json({ lines: [{ status: 'ok', variantId: product.variantId, data: product }] }));
  await pending;
  assert.equal(useCart.getState().items.length, 2);
  assert.equal(useCart.getState().items[0].quantity, 3);
});

it('no restaura productos eliminados mientras se valida el catálogo', async (t) => {
  useCart.getState().add(product);
  let respond!: (response: Response) => void;
  t.mock.method(globalThis, 'fetch', () => new Promise<Response>((resolve) => { respond = resolve; }));
  const pending = useCart.getState().reconcile();
  useCart.getState().remove(product.variantId);
  respond(Response.json({ lines: [{ status: 'ok', variantId: product.variantId, data: product }] }));
  await pending;
  assert.equal(useCart.getState().items.length, 0);
});
