import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import {
  buildBrowserMirrorEvent,
  buildPurchaseEvent,
  buildUserData,
  fbcFromClickId,
  hasAdConsent,
  normalizeCountry,
  normalizeName,
  normalizePhone,
  pixelHashedUserData,
  requestContext,
  type MetaRequestContext,
} from '../lib/meta-capi';
import { toPixelUserData } from '../lib/analytics/meta-pixel';

const h = (v: string) => createHash('sha256').update(v).digest('hex');

const consentCookie = `tienda_consent=${encodeURIComponent(
  JSON.stringify({ v: 1, ts: 1, s: { ad_storage: 'granted' } }),
)}`;

describe('normalización para Meta', () => {
  it('teléfonos de México con lada 52', () => {
    assert.equal(normalizePhone('(449) 123-4567'), '524491234567');
    assert.equal(normalizePhone('+52 1 449 123 4567'), '524491234567');
    assert.equal(normalizePhone('0052 449 123 4567'), '524491234567');
    assert.equal(normalizePhone('123'), null);
  });

  it('nombres sin acentos ni espacios y países en ISO', () => {
    assert.equal(normalizeName('  José María '), 'josemaria');
    assert.equal(normalizeName('Aguascalientes'), 'aguascalientes');
    assert.equal(normalizeCountry('México'), 'mx');
    assert.equal(normalizeCountry('MX'), 'mx');
  });

  it('cifra los datos personales y deja IP, navegador y cookies en claro', () => {
    const data = buildUserData({
      email: ' Laura@Ejemplo.COM ',
      phone: '4491234567',
      firstName: 'Laura',
      birthDate: '1985-03-09',
      clientIp: '200.1.2.3',
      userAgent: 'Mozilla/5.0',
      fbp: 'fb.1.1700000000000.123456789',
      fbc: 'no-es-cookie',
    });
    assert.deepEqual(data.em, [h('laura@ejemplo.com')]);
    assert.deepEqual(data.ph, [h('524491234567')]);
    assert.deepEqual(data.fn, [h('laura')]);
    assert.deepEqual(data.db, [h('19850309')]);
    assert.equal(data.client_ip_address, '200.1.2.3');
    assert.equal(data.fbp, 'fb.1.1700000000000.123456789');
    assert.equal(data.fbc, undefined, 'un _fbc mal formado no se manda');
    assert.equal('ln' in data, false, 'los campos vacíos no se mandan');
  });

  it('arma el fbc desde el fbclid del anuncio', () => {
    assert.equal(fbcFromClickId('IwAR0abcdEFGH123', 1700000000000), 'fb.1.1700000000000.IwAR0abcdEFGH123');
    assert.equal(fbcFromClickId('<script>'), null);
  });

  it('el formato del Pixel coincide con el del servidor', () => {
    const pixel = toPixelUserData({ email: 'Laura@Ejemplo.com', phone: '449 123 4567', country: 'México' });
    assert.equal(pixel.em, 'laura@ejemplo.com');
    assert.equal(pixel.ph, '524491234567');
    assert.equal(pixel.country, 'mx');
    const hashed = pixelHashedUserData(buildUserData({ email: 'laura@ejemplo.com', clientIp: '1.1.1.1' }));
    assert.deepEqual(hashed, { em: h('laura@ejemplo.com') });
  });
});

describe('consentimiento y contexto de la petición', () => {
  it('solo cuenta el consentimiento de publicidad', () => {
    assert.equal(hasAdConsent(consentCookie), true);
    const denied = `tienda_consent=${encodeURIComponent(JSON.stringify({ v: 1, ts: 1, s: { ad_storage: 'denied' } }))}`;
    assert.equal(hasAdConsent(denied), false);
    assert.equal(hasAdConsent(null), false);
    assert.equal(hasAdConsent('tienda_consent=%7Broto'), false);
  });

  it('toma IP, navegador y cookies de Meta', () => {
    const req = new Request('https://tienda.example/api/x', {
      headers: {
        'x-forwarded-for': '200.1.2.3, 10.0.0.1',
        'user-agent': 'UA',
        cookie: `_fbp=fb.1.1.111; _fbc=fb.1.2.abc; ${consentCookie}`,
      },
    });
    assert.deepEqual(requestContext(req), {
      clientIp: '200.1.2.3',
      userAgent: 'UA',
      fbp: 'fb.1.1.111',
      fbc: 'fb.1.2.abc',
      adConsent: true,
    });
  });
});

describe('eventos de servidor', () => {
  const order = {
    number: 'NUME-ABC123',
    customerEmail: 'laura@ejemplo.com',
    customerFirstName: 'Laura',
    customerLastName: 'Rodríguez',
    customerPhone: '4491234567',
    customerBirthDate: '1985-03-09',
    userId: null,
    currency: 'MXN',
    totalAmount: '1780.00',
    shippingAddress: { city: 'Aguascalientes', state: 'Ags', postalCode: '20000' },
    paidAt: new Date('2026-11-14T20:00:00Z'),
    metadata: {
      paymentMode: 'production',
      meta: { fbp: 'fb.1.1.111', fbc: 'fb.1.2.abc', clientIp: '200.1.2.3', userAgent: 'UA', adConsent: true },
    },
  };
  const items = [{ variantId: 'var-morada', productId: 'prod-1', name: 'Agenda', quantity: 2, unitAmount: '890.00' }];

  it('Purchase con el mismo event_id que el Pixel y los ids del catálogo', () => {
    const event = buildPurchaseEvent(order, items, { appUrl: 'https://tienda.example/' });
    assert.equal(event.event_name, 'Purchase');
    assert.equal(event.event_id, 'purchase-NUME-ABC123');
    assert.equal(event.event_time, 1794686400);
    assert.equal(event.action_source, 'website');
    assert.equal(event.event_source_url, 'https://tienda.example/checkout/success');
    assert.deepEqual(event.custom_data?.content_ids, ['var-morada']);
    assert.equal(event.custom_data?.value, 1780);
    assert.equal(event.custom_data?.num_items, 2);
    assert.deepEqual(event.user_data.ln, [h('rodriguez')]);
    assert.deepEqual(event.user_data.zp, [h('20000')]);
    assert.deepEqual(event.user_data.external_id, [h('laura@ejemplo.com')]);
    assert.equal(event.user_data.fbc, 'fb.1.2.abc');
  });

  const ctx: MetaRequestContext = { clientIp: '200.1.2.3', userAgent: 'UA', fbp: null, fbc: null, adConsent: true };

  it('acepta la copia de un evento del embudo de la propia tienda', () => {
    const event = buildBrowserMirrorEvent(
      {
        event_name: 'AddToCart',
        event_id: 'addtocart-123',
        event_source_url: 'https://tienda.example/productos/agenda',
        custom_data: { currency: 'MXN', value: 890, content_ids: ['var-morada'], secreto: 'x' },
        user: { em: 'laura@ejemplo.com' },
      },
      ctx,
      { appHost: 'tienda.example', now: 1_700_000_000_000 },
    );
    assert.equal(event?.event_id, 'addtocart-123');
    assert.equal(event?.event_time, 1_700_000_000);
    assert.deepEqual(event?.custom_data, { currency: 'MXN', value: 890, content_ids: ['var-morada'] });
    assert.deepEqual(event?.user_data.em, [h('laura@ejemplo.com')]);
  });

  it('rechaza Purchase desde el navegador, otros dominios e ids raros', () => {
    const base = { event_id: 'x-1', event_source_url: 'https://tienda.example/', custom_data: {} };
    const opts = { appHost: 'tienda.example' };
    assert.equal(buildBrowserMirrorEvent({ ...base, event_name: 'Purchase' }, ctx, opts), null);
    assert.equal(
      buildBrowserMirrorEvent({ ...base, event_name: 'ViewContent', event_source_url: 'https://otro.com/' }, ctx, opts),
      null,
    );
    assert.equal(buildBrowserMirrorEvent({ ...base, event_name: 'ViewContent', event_id: 'a b' }, ctx, opts), null);
  });
});
