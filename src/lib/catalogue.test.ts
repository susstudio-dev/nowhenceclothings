import { describe, expect, it } from 'vitest';
import { findVariant, getActiveProducts, getCatalogue, getProductBySlug, getStock, isReleased, normaliseCatalogue, orderSizes } from './catalogue';
import { getSettings, getSiteContent } from './content';
import { formatPaise, assertPaise, rupeesToPaise } from './money';

// Reads the committed seed in data/ via the dev filesystem backend.
describe('catalogue (seed)', () => {
  it('loads the catalogue and active products', async () => {
    expect((await getCatalogue()).products.length).toBe(13); // 8 core + 5 launch polos (WS-G)
    expect((await getActiveProducts()).length).toBe(13);
  });

  it('finds products by slug and hides unknown ones', async () => {
    expect((await getProductBySlug('tee-heavyweight'))?.title).toBe('Heavyweight Tee');
    expect(await getProductBySlug('does-not-exist')).toBeNull();
  });

  it('resolves a SKU to product/variant/colour and stock', async () => {
    const p = (await getProductBySlug('tee-heavyweight'))!;
    const sku = p.variants[1].sku;
    const found = await findVariant(sku);
    expect(found?.product.id).toBe(p.id);
    expect(found?.colour.id).toBe(p.variants[1].colourId);
    expect(await getStock(sku)).toBeGreaterThanOrEqual(0);
    expect(await getStock('NOPE')).toBe(0);
  });

  it('gates unreleased drops', async () => {
    const cat = await getCatalogue();
    const dropped = cat.products.find((p) => p.dropId)!;
    expect(isReleased(dropped, cat.drops, new Date('2026-01-01'))).toBe(false);
    expect(isReleased(dropped, cat.drops, new Date('2027-01-01'))).toBe(true);
    expect(isReleased(cat.products.find((p) => !p.dropId)!, cat.drops)).toBe(true);
  });
});

describe('normaliseCatalogue', () => {
  it('orders sizes XS to XXL', () => {
    expect(orderSizes(['S', 'XL', 'XXL', 'XS', 'M', 'L'])).toEqual(['XS', 'S', 'M', 'L', 'XL', 'XXL']);
  });
  it('orders every product and resolves placeholder charts', async () => {
    const cat = await getCatalogue();
    const shuffled = { ...cat, products: cat.products.map((p) => ({ ...p, sizes: [...p.sizes].reverse() })) };
    const out = normaliseCatalogue(shuffled);
    for (const p of out.products) expect(p.sizes).toEqual(orderSizes(p.sizes));
    expect(out.sizeCharts.map((c) => c.name)).toEqual(['Regular fit polo']);
  });
});

describe('content (seed)', () => {
  it('loads site content and settings', async () => {
    expect((await getSiteContent()).home.blocks.length).toBeGreaterThan(0);
    expect((await getSettings()).shipping.flatFee).toBe(9900);
  });
});

describe('money', () => {
  it('formats paise as INR', () => {
    expect(formatPaise(249900)).toBe('₹2,499');
    expect(formatPaise(249950)).toBe('₹2,499.50');
    expect(rupeesToPaise(19.99)).toBe(1999);
    expect(() => assertPaise(1.5)).toThrow();
  });
});
