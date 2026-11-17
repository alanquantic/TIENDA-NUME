import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildMetaCatalogItems,
  metaDateTime,
  productMetaTags,
  renderMetaCatalogRss,
  type CatalogProduct,
} from '../lib/meta-catalog';
import { metaDescription, productBreadcrumbJsonLd, productJsonLd, shareableImages } from '../lib/seo';

const APP = 'https://tienda.numerologia-cotidiana.com';
const NOW = new Date('2026-11-15T12:00:00Z');

function variant(overrides: Partial<CatalogProduct['variants'][number]> = {}): CatalogProduct['variants'][number] {
  return {
    id: 'var-default',
    name: 'Default',
    sku: null,
    priceAmount: '209.00',
    salePriceAmount: null,
    saleStartsAt: null,
    saleEndsAt: null,
    stock: 0,
    trackInventory: false,
    attributes: {},
    isDefault: true,
    ...overrides,
  };
}

function product(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: 'prod-1',
    slug: 'quien-soy',
    name: 'Reporte ¿Quién soy?',
    description: 'Descubre tu esencia & tus números.\n\nBeneficios:\nUno\nDos',
    shortDescription: null,
    type: 'digital',
    currency: 'MXN',
    images: ['https://cdn.example.com/quien-soy.png'],
    metadata: {},
    categoryName: 'Reportes numerológicos',
    categorySlug: 'reportes',
    variants: [variant()],
    ...overrides,
  };
}

describe('metaDescription', () => {
  it('toma el primer párrafo y no corta palabras', () => {
    const text = `${'palabra '.repeat(40)}\n\nBeneficios:\nUno`;
    const result = metaDescription(text, 60);
    assert.ok(result.length <= 60, result);
    assert.ok(result.endsWith('…'));
    assert.ok(!result.includes('Beneficios'));
  });

  it('quita HTML y entidades', () => {
    assert.equal(metaDescription('<p>Hola&nbsp;<b>mundo</b> &amp; más</p>'), 'Hola mundo & más');
  });
});

describe('imágenes', () => {
  it('vuelve absolutas las rutas y descarta SVG', () => {
    assert.deepEqual(
      shareableImages(['/images/a.png', 'https://cdn.x/b.svg', 'https://cdn.x/c.jpg?v=2', '/images/a.png'], APP),
      [`${APP}/images/a.png`, 'https://cdn.x/c.jpg?v=2'],
    );
  });
});

describe('catálogo de Meta', () => {
  it('una fila por variante con el id que manda el pixel', () => {
    const items = buildMetaCatalogItems(
      [
        product({
          variants: [
            variant({ id: 'var-mensual', name: 'Mensual', priceAmount: '149.00' }),
            variant({ id: 'var-anual', name: 'Anual', priceAmount: '1099.00', isDefault: false }),
          ],
        }),
      ],
      { appUrl: APP, now: NOW },
    );
    assert.deepEqual(items.map((i) => i.id), ['var-mensual', 'var-anual']);
    assert.equal(items[0].item_group_id, 'prod-1');
    assert.equal(items[0].title, 'Reporte ¿Quién soy? – Mensual');
    assert.equal(items[1].price, '1099.00 MXN');
    assert.equal(items[0].link, `${APP}/productos/quien-soy`);
    assert.equal(items[0].availability, 'in stock');
    assert.equal(items[0].brand, 'Numerología Cotidiana');
    assert.equal(items[0].custom_label_0, 'digital');
  });

  it('producto con variante "Default" usa solo el nombre', () => {
    const [item] = buildMetaCatalogItems([product()], { appUrl: APP, now: NOW });
    assert.equal(item.title, 'Reporte ¿Quién soy?');
  });

  it('físico sin stock = out of stock', () => {
    const [item] = buildMetaCatalogItems(
      [product({ type: 'physical', variants: [variant({ trackInventory: true, stock: 0 })] })],
      { appUrl: APP, now: NOW },
    );
    assert.equal(item.availability, 'out of stock');
    assert.equal(item.custom_label_0, 'fisico');
  });

  it('oferta vigente: sale_price con su ventana y etiqueta "oferta"', () => {
    const [item] = buildMetaCatalogItems(
      [
        product({
          variants: [
            variant({
              salePriceAmount: '146.30',
              saleStartsAt: new Date('2026-11-13T06:00:00Z'),
              saleEndsAt: new Date('2026-11-18T05:59:00Z'),
            }),
          ],
        }),
      ],
      { appUrl: APP, now: NOW },
    );
    assert.equal(item.sale_price, '146.30 MXN');
    assert.equal(item.sale_price_effective_date, '2026-11-13T00:00-06:00/2026-11-17T23:59-06:00');
    assert.equal(item.custom_label_2, 'oferta');
  });

  it('oferta vencida o mayor al precio no se manda', () => {
    const items = buildMetaCatalogItems(
      [
        product({ variants: [variant({ salePriceAmount: '100.00', saleEndsAt: new Date('2026-11-01T00:00:00Z') })] }),
        product({ id: 'p2', slug: 'b', variants: [variant({ id: 'v2', salePriceAmount: '300.00' })] }),
      ],
      { appUrl: APP, now: NOW },
    );
    assert.equal(items[0].sale_price, undefined);
    assert.equal(items[1].sale_price, undefined);
  });

  it('excluye productos marcados y los que solo tienen SVG', () => {
    const items = buildMetaCatalogItems(
      [
        product({ metadata: { metaCatalogExclude: true } }),
        product({ id: 'p2', slug: 'svg', images: ['https://cdn.x/plan.svg'], variants: [variant({ id: 'v2' })] }),
        product({ id: 'p3', slug: 'ok', variants: [variant({ id: 'v3' })] }),
      ],
      { appUrl: APP, now: NOW },
    );
    assert.deepEqual(items.map((i) => i.id), ['v3']);
  });

  it('el XML escapa caracteres especiales y lleva el espacio de nombres g:', () => {
    const xml = renderMetaCatalogRss(buildMetaCatalogItems([product()], { appUrl: APP, now: NOW }), {
      appUrl: APP,
    });
    assert.match(xml, /xmlns:g="http:\/\/base\.google\.com\/ns\/1\.0"/);
    assert.match(xml, /<g:id>var-default<\/g:id>/);
    assert.match(xml, /tus números\./);
    assert.match(xml, /esencia &amp; tus/);
    assert.ok(!xml.includes('esencia & tus'));
  });
});

describe('JSON-LD de producto', () => {
  it('una variante → Offer con precio vigente y disponibilidad', () => {
    const data = productJsonLd(
      product({ variants: [variant({ salePriceAmount: '146.30', saleEndsAt: new Date('2026-11-18T05:59:00Z') })] }),
      product().variants.map((v) => ({ ...v, salePriceAmount: '146.30', saleEndsAt: new Date('2026-11-18T05:59:00Z') })),
      { appUrl: APP, now: NOW },
    ) as Record<string, any>;
    assert.equal(data['@type'], 'Product');
    assert.equal(data.offers['@type'], 'Offer');
    assert.equal(data.offers.price, '146.30');
    assert.equal(data.offers.priceCurrency, 'MXN');
    assert.equal(data.offers.availability, 'https://schema.org/InStock');
    assert.equal(data.offers.priceValidUntil, '2026-11-18');
    assert.equal(data.brand.name, 'Numerología Cotidiana');
    assert.deepEqual(data.image, ['https://cdn.example.com/quien-soy.png']);
  });

  it('varias variantes → AggregateOffer con rango de precios', () => {
    const variants = [variant({ id: 'a', priceAmount: '149.00' }), variant({ id: 'b', priceAmount: '1099.00' })];
    const data = productJsonLd(product({ variants }), variants, { appUrl: APP, now: NOW }) as Record<string, any>;
    assert.equal(data.offers['@type'], 'AggregateOffer');
    assert.equal(data.offers.lowPrice, '149.00');
    assert.equal(data.offers.highPrice, '1099.00');
    assert.equal(data.offers.offerCount, 2);
  });

  it('migas de pan con URLs absolutas', () => {
    const data = productBreadcrumbJsonLd({ slug: 'quien-soy', name: 'Quién soy' }, APP) as Record<string, any>;
    assert.equal(data.itemListElement[1].item, `${APP}/productos/quien-soy`);
  });
});

describe('imágenes para Meta', () => {
  it('JPG/PNG se mandan tal cual; WebP pasa por el convertidor a JPG', () => {
    const [item] = buildMetaCatalogItems(
      [product({ images: ['https://cdn.tienda.numerologia-cotidiana.com/a.webp', 'https://cdn.tienda.numerologia-cotidiana.com/b.png'] })],
      { appUrl: APP, now: NOW },
    );
    assert.equal(
      item.image_link,
      `${APP}/feeds/imagen.jpg?src=${encodeURIComponent('https://cdn.tienda.numerologia-cotidiana.com/a.webp')}`,
    );
    assert.deepEqual(item.additional_image_link, ['https://cdn.tienda.numerologia-cotidiana.com/b.png']);
  });

  it('el convertidor solo acepta imágenes de la tienda o su CDN', async () => {
    const { isAllowedFeedImageSource } = await import('../lib/meta-catalog');
    assert.equal(isAllowedFeedImageSource('https://cdn.tienda.numerologia-cotidiana.com/x.webp', APP), true);
    assert.equal(isAllowedFeedImageSource(`${APP}/images/a.webp`, APP), true);
    assert.equal(isAllowedFeedImageSource('https://evil.example.com/x.webp', APP), false);
    assert.equal(isAllowedFeedImageSource('http://cdn.tienda.numerologia-cotidiana.com/x.webp', APP), false);
    assert.equal(isAllowedFeedImageSource('file:///etc/passwd', APP), false);
    assert.equal(isAllowedFeedImageSource('no es url', APP), false);
  });
});

describe('ofertas en el formato de Meta', () => {
  it('fechas en hora de México con offset -06:00 (formato documentado por Meta)', () => {
    assert.equal(metaDateTime(new Date('2026-11-18T05:59:00Z')), '2026-11-17T23:59-06:00');
    assert.equal(metaDateTime(new Date('2026-07-01T00:30:00Z')), '2026-06-30T18:30-06:00');
    assert.doesNotMatch(metaDateTime(new Date()), /Z$/);
  });

  it('oferta sin inicio: la ventana arranca "ahora" y termina en su fin', () => {
    const [item] = buildMetaCatalogItems(
      [product({ variants: [variant({ salePriceAmount: '146.30', saleEndsAt: new Date('2026-11-18T06:00:00Z') })] })],
      { appUrl: APP, now: NOW },
    );
    assert.equal(item.price, '209.00 MXN');
    assert.equal(item.sale_price, '146.30 MXN');
    assert.equal(item.sale_price_effective_date, '2026-11-15T06:00-06:00/2026-11-18T00:00-06:00');
  });

  it('el feed publica la fecha con -06:00, nunca con Z', () => {
    const items = buildMetaCatalogItems(
      [product({ variants: [variant({ salePriceAmount: '146.30', saleEndsAt: new Date('2026-11-18T06:00:00Z') })] })],
      { appUrl: APP, now: NOW },
    );
    const xml = renderMetaCatalogRss(items, { appUrl: APP });
    assert.match(xml, /<g:sale_price_effective_date>2026-11-15T06:00-06:00\/2026-11-18T00:00-06:00<\/g:sale_price_effective_date>/);
    assert.doesNotMatch(xml, /\d{2}:\d{2}Z/);
  });

  it('etiquetas product:* de la ficha: precio REGULAR + oferta, mismo id que el feed', () => {
    const v = variant({
      id: 'var-1',
      salePriceAmount: '146.30',
      saleStartsAt: new Date('2026-11-13T06:00:00Z'),
      saleEndsAt: new Date('2026-11-18T05:59:00Z'),
    });
    const tags = Object.fromEntries(productMetaTags(product(), v, { now: NOW }));
    const [feedItem] = buildMetaCatalogItems([product({ variants: [v] })], { appUrl: APP, now: NOW });
    assert.equal(tags['product:retailer_item_id'], feedItem.id);
    assert.equal(tags['product:item_group_id'], 'prod-1');
    assert.equal(tags['product:price:amount'], '209.00');
    assert.equal(tags['product:price:currency'], 'MXN');
    assert.equal(tags['product:sale_price:amount'], '146.30');
    assert.equal(tags['product:sale_price_dates:start'], '2026-11-13T00:00-06:00');
    assert.equal(tags['product:sale_price_dates:end'], '2026-11-17T23:59-06:00');
    assert.equal(tags['product:availability'], 'in stock');
  });

  it('sin oferta vigente no hay etiquetas de sale_price', () => {
    const tags = Object.fromEntries(
      productMetaTags(product(), variant({ salePriceAmount: '100.00', saleEndsAt: new Date('2026-11-01T00:00:00Z') }), { now: NOW }),
    );
    assert.equal(tags['product:price:amount'], '209.00');
    assert.equal(tags['product:sale_price:amount'], undefined);
  });

  it('JSON-LD en oferta: price = lo que se cobra y el regular como StrikethroughPrice', () => {
    const data = productJsonLd(
      { slug: 'quien-soy', name: 'Q', description: null, shortDescription: null, type: 'digital', currency: 'MXN', images: [], categoryName: null },
      [variant({ salePriceAmount: '146.30', saleEndsAt: new Date('2026-11-18T06:00:00Z') })],
      { appUrl: APP, now: NOW },
    );
    const offer = data.offers as Record<string, unknown>;
    assert.equal(offer.price, '146.30');
    const specs = offer.priceSpecification as Array<Record<string, unknown>>;
    assert.equal(specs.find((p) => p.priceType === 'https://schema.org/StrikethroughPrice')?.price, '209.00');
  });
});
