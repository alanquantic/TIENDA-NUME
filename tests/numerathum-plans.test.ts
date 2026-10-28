import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildPurchasePayload, type ItemLike, type OrderLike } from '../lib/external-purchase';
import { NUMERATHUM_PLANS, NUMERATHUM_PLANS_CATEGORY_SLUG, planPeriod } from '../lib/numerathum-plans';
import {
  accessForProduct,
  AGENDA_FISICA_2026_SLUG,
  groupForProduct,
  NUMERATHUM_SLUG,
} from '../lib/product-groups';

describe('planes Numerathum', () => {
  it('reconoce la vigencia de la variante', () => {
    assert.equal(planPeriod('Mensual'), 'monthly');
    assert.equal(planPeriod('Anual'), 'annual');
    assert.equal(planPeriod('ANUAL · 12 meses'), 'annual');
    assert.equal(planPeriod('Default'), null);
    assert.equal(planPeriod(null), null);
  });

  it('toda la categoría se entrega como Numerathum', () => {
    assert.equal(groupForProduct('numerathum-espejo', NUMERATHUM_PLANS_CATEGORY_SLUG), 'numerathum');
    assert.equal(groupForProduct('plan-nuevo', NUMERATHUM_PLANS_CATEGORY_SLUG), 'numerathum');
    assert.equal(groupForProduct('numerathum-espejo', 'otra'), null);
  });

  it('la vigencia sale de la variante comprada', () => {
    assert.deepEqual(accessForProduct('numerathum-espejo', 'Mensual')?.duration, { value: 1, unit: 'month' });
    assert.deepEqual(accessForProduct('numerathum-espejo', 'Anual')?.duration, { value: 12, unit: 'month' });
    // Sin vigencia reconocible se asume la anual.
    assert.deepEqual(accessForProduct('numerathum-horizonte-60', 'Otra')?.duration, { value: 12, unit: 'month' });
    assert.equal(accessForProduct('numerathum-oraculo-365', 'Anual')?.planCode, 'numerathum-oraculo-365');
    // El Oráculo 365 que ya se vendía no cambia.
    assert.deepEqual(accessForProduct(NUMERATHUM_SLUG, 'Default')?.duration, { value: 1, unit: 'year' });
  });

  it('el aviso externo lleva la vigencia de cada variante', () => {
    const order: OrderLike = {
      id: 'o1', number: 'NUME-1', status: 'paid', currency: 'MXN', paidAt: '2026-10-26T12:00:00.000Z',
      subtotalAmount: '1248.00', discountAmount: '0.00', discountCode: null, shippingAmount: '0.00',
      taxAmount: '0.00', totalAmount: '1248.00', requiresShipping: false, shippingMethod: null,
      shippingAddress: null, requiresInvoice: false, billingInfo: null, customerEmail: 'a@b.mx',
      customerFirstName: 'A', customerLastName: 'B', customerPhone: null, customerBirthDate: null,
    };
    const item = (slug: string, variantName: string, amount: string): ItemLike => ({
      id: `line-${slug}`, slug, name: slug, variantName, sku: null, type: 'digital', quantity: 1, unitAmount: amount, totalAmount: amount,
    });
    const items = [item('numerathum-espejo', 'Mensual', '149.00'), item('numerathum-horizonte-60', 'Anual', '1099.00')];
    const payload = buildPurchasePayload({ kind: 'numerathum', order, items, triggerItems: items });
    assert.equal(payload.triggeredBy[0].access?.expiresAt, '2026-11-26T12:00:00.000Z');
    assert.equal(payload.triggeredBy[0].access?.durationMonths, 1);
    assert.equal(payload.triggeredBy[1].access?.expiresAt, '2027-10-26T12:00:00.000Z');
    assert.equal(payload.triggeredBy[1].access?.planCode, 'numerathum-horizonte-60');
  });

  it('cada variante manda su billingCycle (contrato WEBHOOK_TIENDA.md de Numerathum)', () => {
    const order: OrderLike = {
      id: 'o2', number: 'NUME-2', status: 'paid', currency: 'MXN', paidAt: '2026-10-28T12:00:00.000Z',
      subtotalAmount: '0.00', discountAmount: '0.00', discountCode: null, shippingAmount: '0.00',
      taxAmount: '0.00', totalAmount: '0.00', requiresShipping: false, shippingMethod: null,
      shippingAddress: null, requiresInvoice: false, billingInfo: null, customerEmail: 'a@b.mx',
      customerFirstName: 'A', customerLastName: 'B', customerPhone: null, customerBirthDate: null,
    };
    const access = (slug: string, variantName: string) => {
      const item: ItemLike = {
        id: 'line-1', slug, name: slug, variantName, sku: null, type: 'digital', quantity: 1, unitAmount: '0.00', totalAmount: '0.00',
      };
      return buildPurchasePayload({ kind: 'numerathum', order, items: [item], triggerItems: [item] }).order.items[0].access;
    };
    assert.equal(access('numerathum-espejo', 'Mensual')?.billingCycle, 'monthly');
    assert.equal(access('numerathum-espejo', 'Anual')?.billingCycle, 'annual');
    assert.equal(access('numerathum-horizonte-60', 'Mensual')?.billingCycle, 'monthly');
    assert.equal(access('numerathum-horizonte-60', 'Anual')?.billingCycle, 'annual');
    assert.equal(access('numerathum-oraculo-365', 'Anual')?.billingCycle, 'annual');
    assert.equal(access(NUMERATHUM_SLUG, 'Default')?.billingCycle, 'annual');
    // Duraciones que no son 1 ni 12 meses no llevan ciclo.
    assert.equal(access('membresia-180', 'Default')?.billingCycle, null);
  });

  it('cada producto lleva el id de su línea y la Agenda física su planCode', () => {
    const order: OrderLike = {
      id: 'o3', number: 'NUME-3', status: 'paid', currency: 'MXN', paidAt: '2026-10-28T12:00:00.000Z',
      subtotalAmount: '0.00', discountAmount: '0.00', discountCode: null, shippingAmount: '0.00',
      taxAmount: '0.00', totalAmount: '0.00', requiresShipping: true, shippingMethod: null,
      shippingAddress: null, requiresInvoice: false, billingInfo: null, customerEmail: 'a@b.mx',
      customerFirstName: 'A', customerLastName: 'B', customerPhone: null, customerBirthDate: null,
    };
    const plan: ItemLike = {
      id: 'line-plan', slug: 'numerathum-oraculo-365', name: 'Oráculo', variantName: 'Anual', sku: null,
      type: 'digital', quantity: 1, unitAmount: '0.00', totalAmount: '0.00',
    };
    const agenda: ItemLike = {
      id: 'line-agenda', slug: AGENDA_FISICA_2026_SLUG, name: 'Agenda', variantName: null, sku: null,
      type: 'physical', quantity: 1, unitAmount: '0.00', totalAmount: '0.00',
    };
    const payload = buildPurchasePayload({
      kind: 'agenda-fisica-2026', order, items: [plan, agenda], triggerItems: [agenda],
    });
    assert.deepEqual(payload.order.items.map((i) => i.id), ['line-plan', 'line-agenda']);
    assert.equal(payload.triggeredBy[0].id, 'line-agenda');
    assert.equal(payload.order.items[1].access?.planCode, 'agenda-fisica-2026');
    assert.equal(payload.order.items[1].access?.durationMonths, 1);
  });

  it('los planCode que manda la tienda los reconoce Numerathum', () => {
    // Entradas de PLANCODE_TO_PLAN en demonume/api/webhooks/kit-numerathum.js.
    const receiver: Record<string, string> = {
      'numerathum-espejo': 'ESPEJO',
      'numerathum-horizonte-60': 'HORIZONTE_60',
      'numerathum-oraculo-365': 'ORACULO_365',
    };
    for (const plan of NUMERATHUM_PLANS) {
      assert.ok(receiver[plan.planCode], `${plan.slug} manda un planCode desconocido: ${plan.planCode}`);
    }
  });
});
