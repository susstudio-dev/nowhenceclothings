import { describe, expect, it } from 'vitest';
import {
  breadcrumbLd,
  faqLd,
  jsonLdScript,
  organizationLd,
  priceValidUntil,
  productAvailability,
  productBreadcrumb,
  productLd,
  returnPolicyLd,
  webSiteLd,
} from './jsonld';
import { isIndexable } from './launches';
import { NOW, publicProduct, settings } from './__fixtures__/seo';

const S = settings();
const STOCK = { 'NWH-POLO-BLK-S': 3, 'NWH-POLO-BLK-M': 0 };

describe('jsonLdScript', () => {
  it('escapes script-closing content', () => {
    const s = jsonLdScript({ a: '</script><script>alert(1)</script>' });
    expect(s).not.toContain('<');
    expect(JSON.parse(s).a).toBe('</script><script>alert(1)</script>');
  });
});

describe('organizationLd', () => {
  it('uses the square symbol PNG as logo and normalises social links', () => {
    const ld = organizationLd({ ...S, legal: { legalName: 'Sanbhanu Private Limited' } });
    expect(ld.name).toBe('Nowhence');
    expect(ld.legalName).toBe('Sanbhanu Private Limited');
    expect(ld.url).toBe('https://nowhenceclothings.com');
    expect(ld.logo).toMatchObject({ url: 'https://nowhenceclothings.com/brand-default/icon-512.png', width: 512, height: 512 });
    // A bare handle must never be emitted as a sameAs "URL".
    expect(ld.sameAs).toEqual(['https://www.instagram.com/nowhence_clothings']);
    expect(ld.contactPoint).toMatchObject({ '@type': 'ContactPoint', email: 'hello@nowhenceclothings.com', areaServed: 'IN' });
  });

  it('omits what is not set', () => {
    const ld = organizationLd(settings({ store: { email: 'a@b.co', instagram: '' } }));
    expect(ld.sameAs).toBeUndefined();
    expect(ld.legalName).toBeUndefined();
    expect(organizationLd().name).toBe('Nowhence');
  });
});

describe('webSiteLd / breadcrumbLd', () => {
  it('declares the sitelinks search box', () => {
    const ld = webSiteLd();
    expect(ld.url).toBe('https://nowhenceclothings.com');
    expect(ld.potentialAction.target.urlTemplate).toBe('https://nowhenceclothings.com/search?q={search_term_string}');
    expect(ld.potentialAction['query-input']).toBe('required name=search_term_string');
  });

  it('builds canonical breadcrumb items', () => {
    const b = breadcrumbLd([
      { name: 'Home', path: '/' },
      { name: 'Shop', path: '/shop/?sort=new' },
    ]);
    expect(b.itemListElement[1]).toMatchObject({ position: 2, item: 'https://nowhenceclothings.com/shop' });
    const p = productBreadcrumb({ title: 'Polo', slug: 'polo' }, { name: 'Tops', slug: 'tops' });
    expect(p.itemListElement.map((i) => i.name)).toEqual(['Home', 'Shop', 'Tops', 'Polo']);
  });
});

describe('productLd', () => {
  it('describes one Product with brand, sku/mpn, images and an INR offer', () => {
    const ld = productLd(publicProduct(), { stock: STOCK, settings: S, category: { name: 'Tops' }, now: NOW });
    expect(ld['@type']).toBe('Product');
    expect(ld.url).toBe('https://nowhenceclothings.com/products/polo-black');
    expect(ld.brand).toEqual({ '@type': 'Brand', name: 'Nowhence' });
    expect(ld.sku).toBe('NWH-POLO-BLK-S');
    expect(ld.mpn).toBe('NWH-POLO-BLK-S');
    expect(ld.image).toEqual(['https://nowhenceclothings.com/media/m1/1600.webp', 'https://nowhenceclothings.com/media/m2/1600.webp']);
    expect(ld.color).toBe('Black');
    expect(ld.category).toBe('Tops');
    expect(ld.offers).toMatchObject({
      '@type': 'Offer',
      price: '1499.00',
      priceCurrency: 'INR',
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      url: 'https://nowhenceclothings.com/products/polo-black',
      seller: { '@id': 'https://nowhenceclothings.com/#organization' },
    });
  });

  it('adds shipping to India and the returns policy from settings', () => {
    const { offers } = productLd(publicProduct(), { stock: STOCK, settings: S, now: NOW });
    expect(offers.shippingDetails).toMatchObject({
      '@type': 'OfferShippingDetails',
      shippingRate: { value: '99.00', currency: 'INR' },
      shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IN' },
    });
    expect(offers.hasMerchantReturnPolicy).toMatchObject({
      applicableCountry: 'IN',
      returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
      merchantReturnDays: 7,
      merchantReturnLink: 'https://nowhenceclothings.com/returns',
    });
    // At or above the free-shipping threshold the rate is zero.
    const free = productLd(publicProduct({ price: 399900 }), { stock: STOCK, settings: S, now: NOW });
    expect(free.offers.shippingDetails?.shippingRate.value).toBe('0.00');
    // Without settings nothing is invented.
    expect(productLd(publicProduct(), { stock: STOCK, now: NOW }).offers.shippingDetails).toBeUndefined();
  });

  it('reflects a no-returns policy', () => {
    const p = returnPolicyLd(settings({ returns: { returnsAllowed: false, exchangesAllowed: false } }).returns);
    expect(p.returnPolicyCategory).toBe('https://schema.org/MerchantReturnNotPermitted');
    expect(p).not.toHaveProperty('merchantReturnDays');
  });

  it('is OutOfStock when nothing is in stock, or when sold out', () => {
    expect(productAvailability(publicProduct(), { stock: {} }).availability).toBe('https://schema.org/OutOfStock');
    expect(productAvailability(publicProduct({ availability: 'sold_out' }), { stock: STOCK }).availability).toBe('https://schema.org/OutOfStock');
  });

  it('marks a deposit presale PreOrder and opens it on the sale date', () => {
    const pre = publicProduct({
      availability: 'presale',
      presale: { enabled: true, paymentMode: 'deposit', deposit: { saleStartsAt: '2026-12-01T04:30:00.000Z' }, shipBy: '2026-12-20' },
    });
    expect(pre.launch.state).toBe('presale');
    const { offers } = productLd(pre, { stock: {}, settings: S, now: NOW });
    expect(offers.availability).toBe('https://schema.org/PreOrder');
    expect(offers.availabilityStarts).toBe('2026-12-01T04:30:00.000Z');
  });

  it('marks an unreleased drop PreOrder with the release date', () => {
    const drop = { id: 'd', name: 'D', slug: 'd', releaseAt: '2027-01-15T00:00:00.000Z', description: '', seo: {} };
    const a = productAvailability(publicProduct({ dropId: 'd' }), { drop, stock: STOCK, now: NOW });
    expect(a).toEqual({ availability: 'https://schema.org/PreOrder', availabilityStarts: '2027-01-15T00:00:00.000Z' });
    const released = productAvailability(publicProduct({ dropId: 'd' }), { drop: { ...drop, releaseAt: '2026-01-01T00:00:00.000Z' }, stock: STOCK, now: NOW });
    expect(released.availability).toBe('https://schema.org/InStock');
  });

  it('sets priceValidUntil: sale end, presale end, else a year out', () => {
    expect(priceValidUntil(publicProduct(), NOW)).toBe('2027-10-17');
    const sale = publicProduct({ compareAtPrice: 199900, saleEndsAt: '2026-11-30T18:29:59.000Z' });
    expect(priceValidUntil(sale, NOW)).toBe('2026-11-30');
    const ended = publicProduct({ compareAtPrice: 199900, saleEndsAt: '2026-01-01T00:00:00.000Z' });
    expect(priceValidUntil(ended, NOW)).toBe('2027-10-17');
    const pre = publicProduct({ availability: 'presale', presale: { enabled: true, endsAt: '2026-11-10T00:00:00.000Z' } });
    expect(priceValidUntil(pre, NOW)).toBe('2026-11-10');
  });

  it('uses an AggregateOffer when variants are priced differently', () => {
    const p = publicProduct({
      variants: [
        { sku: 'NWH-POLO-BLK-S', colourId: 'blk', size: 'S' },
        { sku: 'NWH-POLO-BLK-M', colourId: 'blk', size: 'M', priceOverride: 159900 },
      ],
    });
    expect(productLd(p, { stock: STOCK, now: NOW }).offers).toMatchObject({
      '@type': 'AggregateOffer',
      lowPrice: '1499.00',
      highPrice: '1599.00',
      offerCount: 2,
      priceCurrency: 'INR',
    });
  });

  it('serialises without script-breaking characters', () => {
    const p = publicProduct({ description: 'Soft </script> cotton' });
    expect(jsonLdScript(productLd(p, { stock: STOCK, now: NOW }))).not.toContain('<');
  });
});

describe('coming-soon secrecy', () => {
  it('coming-soon pieces are not indexable, so pages emit no Product JSON-LD for them', () => {
    const cs = publicProduct({ availability: 'coming_soon' });
    expect(cs.launch.state).toBe('coming_soon');
    expect(isIndexable(cs)).toBe(false);
    expect(isIndexable(publicProduct())).toBe(true);
    expect(isIndexable(publicProduct({ availability: 'presale', presale: { enabled: true } }))).toBe(true);
  });
});

describe('faqLd', () => {
  it('strips markdown from answers', () => {
    expect(faqLd([{ q: 'Q', a: '**A** [x](/y)' }]).mainEntity[0].acceptedAnswer.text).toBe('A x');
  });
});
