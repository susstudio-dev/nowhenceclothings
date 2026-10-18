import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CatalogueDoc, type Drop, type Product } from './schemas/catalogue';
import { LaunchDefaults, type PresaleLedgerDoc } from './schemas/launches';
import { SettingsDoc } from './schemas/settings';
import {
  PresaleRuleError,
  assertNotMixed,
  assertPresaleAccess,
  codeMatches,
  formatShipCopy,
  isIndexable,
  presaleTerms,
  listedOn,
  releasePresale,
  reservePresale,
  resolveLaunch,
  toPublicProduct,
} from './launches';
import { buildSitemap } from './sitemap';
import { buildSearchIndex } from '@/components/shop/merch';

const D = LaunchDefaults.parse({});
const NOW = new Date('2026-10-20T00:00:00Z');
const img = (id: string) => ({ id, alt: 'Sharp', width: 800, height: 1000, widths: [800] });

function product(over: Partial<Product> = {}): Product {
  return {
    id: 'prod-secret',
    slug: 'piece-01',
    title: 'Secret Rain Polo',
    description: 'Secret description',
    categoryId: 'cat',
    collectionIds: [],
    status: 'active',
    price: 349900,
    colours: [{ id: 'navy', name: 'Navy', hex: '#000000', images: [img('sharp-original-1'), img('sharp-original-2')] }],
    sizes: ['M'],
    variants: [{ sku: 'NWH-X-NAV-M', colourId: 'navy', size: 'M', priceOverride: 359900 }],
    fabric: 'Secret fabric',
    care: '',
    fit: '',
    sizeChartId: 'c',
    relatedIds: [],
    sortOrder: 0,
    seo: { title: 'Secret SEO', ogImage: img('sharp-og') },
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...over,
  };
}

const blurredCfg = {
  revealTo: 'available' as const,
  blurred: [{ sourceId: 'sharp-original-1', strength: 30, media: img('blurred-1') }],
};

describe('resolveLaunch (dates evaluated at request time)', () => {
  it('defaults to available', () => {
    expect(resolveLaunch(product(), [], D, NOW).state).toBe('available');
  });
  it('coming soon flips at revealAt to revealTo', () => {
    const p = product({ availability: 'coming_soon', comingSoon: { ...blurredCfg, revealAt: '2026-10-21T00:00:00Z', revealTo: 'presale' } });
    const before = resolveLaunch(p, [], D, NOW);
    expect(before.state).toBe('coming_soon');
    expect(before.nextChangeAt).toBe('2026-10-21T00:00:00Z');
    expect(resolveLaunch(p, [], D, new Date('2026-10-21T00:00:01Z')).state).toBe('presale');
  });
  it('presale before start is coming soon, after end is available or sold out', () => {
    const presale = { enabled: true, startsAt: '2026-10-25T00:00:00Z', endsAt: '2026-11-01T00:00:00Z' };
    const p = product({ availability: 'presale', presale });
    expect(resolveLaunch(p, [], D, NOW).state).toBe('coming_soon');
    expect(resolveLaunch(p, [], D, new Date('2026-10-26T00:00:00Z')).state).toBe('presale');
    expect(resolveLaunch(p, [], D, new Date('2026-11-02T00:00:00Z')).state).toBe('available');
    const q = product({ availability: 'presale', presale: { ...presale, autoSwitchAtEnd: false } });
    expect(resolveLaunch(q, [], D, new Date('2026-11-02T00:00:00Z')).state).toBe('sold_out');
  });
  it('available product inherits an open drop-level presale window', () => {
    const drop: Drop = {
      id: 'd1',
      name: 'Drop',
      slug: 'drop',
      releaseAt: '2026-12-01T00:00:00Z',
      description: '',
      seo: {},
      presale: { enabled: true, startsAt: '2026-10-01T00:00:00Z', endsAt: '2026-11-01T00:00:00Z', price: 100000 },
    };
    const r = resolveLaunch(product({ dropId: 'd1' }), [drop], D, NOW);
    expect(r.state).toBe('presale');
    expect(r.presale?.source).toBe('drop');
    expect(r.presale?.price).toBe(100000);
  });
});

describe('toPublicProduct secrecy (no leaks)', () => {
  const settings = SettingsDoc.parse({
    shipping: { flatFee: 0, freeShippingThreshold: 0 },
    store: { email: 'a@b.co' },
    launches: { comingSoon: { showTitle: false, showPrice: false, hiddenTitle: 'Piece 01' } },
  });
  const secret = product({ availability: 'coming_soon', comingSoon: blurredCfg });
  const pub = toPublicProduct(secret, [], settings.launches, NOW);
  const serialized = JSON.stringify(pub);

  it('exposes only the pre-blurred variant, never the sharp media ids', () => {
    expect(serialized).not.toContain('sharp-original-1');
    expect(serialized).not.toContain('sharp-original-2');
    expect(serialized).not.toContain('sharp-og');
    expect(pub.colours[0].images.map((m) => m.id)).toEqual(['blurred-1']);
  });
  it('hides title, price, copy and raw launch config', () => {
    expect(serialized).not.toContain('Secret');
    expect(serialized).not.toContain('349900');
    expect(serialized).not.toContain('359900');
    expect(serialized).not.toContain('blurred":[');
    expect(pub.title).toBe('Piece 01');
    expect(pub.price).toBe(0);
    expect(pub.launch).toMatchObject({ state: 'coming_soon', titleHidden: true, priceHidden: true, blurred: true });
  });
  it('search index, sitemap and indexability exclude coming soon', () => {
    expect(JSON.stringify(buildSearchIndex([pub]))).not.toContain('Secret');
    expect(isIndexable(pub)).toBe(false);
    const cat = CatalogueDoc.parse({});
    const sm = buildSitemap({ ...cat, products: [pub].filter(isIndexable) }, {
      announcement: { enabled: false, text: '' },
      nav: { primary: [], footer: [] },
      home: { blocks: [], seo: {} },
      pages: {},
      lookbook: [],
      journal: [],
    } as never);
    expect(JSON.stringify(sm)).not.toContain('piece-01');
  });
  it('never sends the access code', () => {
    const p = product({ availability: 'presale', presale: { enabled: true, access: 'code', accessCode: 'TOPSECRET', price: 299900 } });
    const out = toPublicProduct(p, [], D, NOW);
    expect(JSON.stringify(out)).not.toContain('TOPSECRET');
    expect(out.price).toBe(299900);
    expect(out.compareAtPrice).toBe(349900);
    expect(out.variants[0].priceOverride).toBeUndefined();
  });
  it('surfaces follow the per-product flags', () => {
    const hidden = product({ availability: 'coming_soon', comingSoon: { ...blurredCfg, showInShop: false } });
    const p = toPublicProduct(hidden, [], D, NOW);
    expect(listedOn(p, 'shop', hidden, D)).toBe(false);
    expect(listedOn(p, 'home', hidden, D)).toBe(true);
    expect(listedOn(p, 'comingSoonPage', hidden, D)).toBe(true);
  });
});

describe('presale rules', () => {
  const empty: PresaleLedgerDoc = { reservations: [] };
  const at = '2026-10-20T00:00:00.000Z';
  it('enforces the total cap', () => {
    const a = reservePresale(empty, { orderId: 'o1', email: 'a@x.co', qty: 2, cap: 3, perCustomerLimit: 5, at });
    expect(() => reservePresale(a, { orderId: 'o2', email: 'b@x.co', qty: 2, cap: 3, perCustomerLimit: 5, at })).toThrow(/Only 1/);
    const b = reservePresale(a, { orderId: 'o2', email: 'b@x.co', qty: 1, cap: 3, perCustomerLimit: 5, at });
    expect(() => reservePresale(b, { orderId: 'o3', email: 'c@x.co', qty: 1, cap: 3, perCustomerLimit: 5, at })).toThrow(/full/);
  });
  it('enforces the per-customer limit by email (case-insensitive)', () => {
    const a = reservePresale(empty, { orderId: 'o1', email: 'A@x.co', qty: 1, perCustomerLimit: 2, at });
    expect(() => reservePresale(a, { orderId: 'o2', email: 'a@X.CO'.toLowerCase(), qty: 2, perCustomerLimit: 2, at })).toThrow(PresaleRuleError);
  });
  it('is idempotent per order and releasable', () => {
    const a = reservePresale(empty, { orderId: 'o1', email: 'a@x.co', qty: 1, perCustomerLimit: 2, at });
    expect(reservePresale(a, { orderId: 'o1', email: 'a@x.co', qty: 1, perCustomerLimit: 2, at })).toBe(a);
    expect(releasePresale(a, 'o1').reservations).toEqual([]);
  });
  it('rejects mixed carts', () => {
    expect(() => assertNotMixed([true, false])).toThrow(/own checkout/);
    expect(() => assertNotMixed([true, true])).not.toThrow();
    expect(() => assertNotMixed([false])).not.toThrow();
  });
  it('access gate: code and waitlist', () => {
    expect(codeMatches('EARLY', ' early ')).toBe(true);
    expect(codeMatches('EARLY', 'EARL')).toBe(false);
    expect(codeMatches(undefined, '')).toBe(false);
    expect(() => assertPresaleAccess({ access: 'code', accessCode: 'EARLY' }, { code: 'nope', waitlist: [] })).toThrow(/code/);
    expect(() => assertPresaleAccess({ access: 'code', accessCode: 'EARLY' }, { code: 'early', waitlist: [] })).not.toThrow();
    expect(() => assertPresaleAccess({ access: 'waitlist' }, { email: 'x@y.co', waitlist: ['a@b.co'] })).toThrow(/waitlist/);
    expect(() => assertPresaleAccess({ access: 'waitlist' }, { email: 'A@b.co', waitlist: ['a@b.co'] })).not.toThrow();
    expect(() => assertPresaleAccess({ access: 'public' }, { waitlist: [] })).not.toThrow();
  });
});

describe('seed data', () => {
  it('catalogue with the five polos parses and has the expected launch states', () => {
    const raw = JSON.parse(readFileSync(path.join(process.cwd(), 'data', 'catalogue.json'), 'utf8'));
    const cat = CatalogueDoc.parse(raw);
    const polos = cat.products.filter((p) => p.id.startsWith('prod-polo-'));
    expect(polos).toHaveLength(5);
    expect(polos.filter((p) => p.availability === 'coming_soon')).toHaveLength(4);
    for (const p of polos) {
      expect(p.sizes).toEqual(['XS', 'S', 'M', 'L', 'XL', 'XXL']);
      if (p.availability === 'coming_soon') {
        const pub = toPublicProduct(p, cat.drops, D, NOW);
        expect(JSON.stringify(pub)).not.toContain(`"${p.colours[0].images[0].id}"`);
      }
    }
    expect(polos.find((p) => p.availability === 'presale')?.presale?.enabled).toBe(true);
  });
});

describe('ship copy and deposit projection', () => {
  it('fills {date} when a ship-by date is set', () => {
    expect(formatShipCopy('Made to order. Ships by {date}.', '2026-12-15')).toBe('Made to order. Ships by 15 December 2026.');
  });
  it('drops the date sentence when no ship-by date is set (never "the date shown")', () => {
    expect(formatShipCopy('Made to order. Ships by {date}.', undefined)).toBe('Made to order.');
    expect(formatShipCopy('Ships by {date}.', undefined)).toBe('');
    expect(formatShipCopy('Made to order. Ships by {date}.', undefined, { deposit: true })).toBe('Made to order. Ships after the sale opens.');
    expect(formatShipCopy('Limited first run of 100. Orders ship within 2–3 weeks of the sale opening.', undefined, { deposit: true })).toBe(
      'Limited first run of 100. Orders ship within 2–3 weeks of the sale opening.',
    );
    expect(formatShipCopy('Hand finished in Tiruppur.', undefined)).toBe('Hand finished in Tiruppur.');
  });
  it('strips "ship by the date shown" from default terms without a date', () => {
    const t = D.presale.terms;
    expect(presaleTerms(t, undefined)).toBe('Pre-orders are paid in full today. Pre-orders cannot be combined with in-stock pieces.');
    expect(presaleTerms(t, '2026-12-15')).toBe(t);
  });
  it('projects deposit amount, price lock and balance window for the storefront', () => {
    const p = product({
      availability: 'presale',
      price: 149900,
      variants: [{ sku: 'NWH-X-NAV-M', colourId: 'navy', size: 'M' }],
      presale: {
        enabled: true,
        paymentMode: 'deposit',
        deposit: { depositType: 'fixed', depositValue: 50000, saleStartsAt: '2026-10-31T04:30:00.000Z', balanceWindowDays: 7, priceLock: 'booking' },
      },
    } as Partial<Product>);
    const pub = toPublicProduct(p, [], D, NOW);
    expect(pub.launch.presale?.shipCopy).toBe('Limited first run. Ships after the sale opens.');
    expect(pub.launch.presale?.deposit).toMatchObject({ amount: 50000, priceLock: 'booking', balanceWindowDays: 7, saleStartsAt: '2026-10-31T04:30:00.000Z' });
    expect(pub.launch.presale?.deposit).toMatchObject({ refundable: false, unpaidOutcome: 'forfeit' });
  });
});
