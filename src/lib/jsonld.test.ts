import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { breadcrumbLd, faqLd, jsonLdScript, organizationLd, productLd, webSiteLd } from './jsonld';
import { CatalogueDoc } from './schemas/catalogue';

const catalogue = CatalogueDoc.parse(JSON.parse(readFileSync('data/catalogue.json', 'utf8')));
const product = catalogue.products[0];

describe('jsonld', () => {
  it('escapes script-closing content', () => {
    const s = jsonLdScript({ a: '</script><script>alert(1)</script>' });
    expect(s).not.toContain('<');
    expect(JSON.parse(s).a).toBe('</script><script>alert(1)</script>');
  });

  it('builds a ProductGroup with per-variant offers in rupees', () => {
    const v0 = product.variants[0];
    const ld = productLd(product, { stock: { [v0.sku]: 3 } });
    expect(ld['@type']).toBe('ProductGroup');
    expect(ld.url).toBe(`https://nowhenceclothings.com/products/${product.slug}`);
    expect(ld.hasVariant).toHaveLength(product.variants.length);
    expect(ld.hasVariant[0].offers.priceCurrency).toBe('INR');
    expect(ld.hasVariant[0].offers.price).toBe(((v0.priceOverride ?? product.price) / 100).toFixed(2));
    expect(ld.hasVariant[0].offers.availability).toBe('https://schema.org/InStock');
    expect(ld.hasVariant[1].offers.availability).toBe('https://schema.org/OutOfStock');
  });

  it('marks unreleased drop offers as PreOrder', () => {
    const drop = { id: 'd', name: 'D', slug: 'd', releaseAt: '2099-01-01T00:00:00.000Z', description: '', seo: {} };
    const ld = productLd(product, { drop, now: new Date('2026-01-01') });
    expect(ld.hasVariant.every((v) => v.offers.availability === 'https://schema.org/PreOrder')).toBe(true);
  });

  it('breadcrumb, faq, organization, website', () => {
    const b = breadcrumbLd([
      { name: 'Home', path: '/' },
      { name: 'Shop', path: '/shop' },
    ]);
    expect(b.itemListElement[1]).toMatchObject({ position: 2, item: 'https://nowhenceclothings.com/shop' });
    expect(faqLd([{ q: 'Q', a: '**A** [x](/y)' }]).mainEntity[0].acceptedAnswer.text).toBe('A x');
    expect(organizationLd().name).toBe('Nowhence');
    expect(webSiteLd().url).toBe('https://nowhenceclothings.com');
  });
});
