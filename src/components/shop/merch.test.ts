import { describe, expect, it } from 'vitest';
import { Product } from '@/lib/schemas/catalogue';
import type { InventoryDoc } from '@/lib/schemas/inventory';
import {
  buildSearchIndex,
  cmToIn,
  completeTheLook,
  countdownParts,
  facets,
  filterProducts,
  isSoldOut,
  listingHref,
  parseListingParams,
  searchIndex,
  sizeChartTable,
  sortProducts,
  variantPrice,
} from './merch';

const mk = (o: Partial<Product> & { id: string }) =>
  Product.parse({
    slug: o.id,
    title: o.id,
    categoryId: 'tops',
    status: 'active',
    price: 100000,
    colours: [{ id: 'ink', name: 'Ink', hex: '#141412' }],
    sizes: ['S', 'M'],
    variants: [
      { sku: `${o.id.toUpperCase()}-S`, colourId: 'ink', size: 'S' },
      { sku: `${o.id.toUpperCase()}-M`, colourId: 'ink', size: 'M' },
    ],
    sizeChartId: 'c',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...o,
  });

const a = mk({ id: 'tee', title: 'Heavyweight Tee', price: 249900, sortOrder: 2, createdAt: '2026-03-01T00:00:00Z', collectionIds: ['core'] });
const b = mk({
  id: 'pant',
  title: 'Wide Pant',
  categoryId: 'bottoms',
  price: 399900,
  sortOrder: 1,
  collectionIds: ['core'],
  colours: [{ id: 'bone', name: 'Bone', hex: '#E8E2D6', images: [] }],
  variants: [
    { sku: 'PANT-S', colourId: 'bone', size: 'S' },
    { sku: 'PANT-M', colourId: 'bone', size: 'M' },
  ],
});
const c = mk({ id: 'cap', title: 'Cap', price: 99900, sortOrder: 0 });
const inv: InventoryDoc = {
  'TEE-S': { stock: 0, reserved: 0, lowStockAt: 3 },
  'TEE-M': { stock: 4, reserved: 0, lowStockAt: 3 },
  'PANT-S': { stock: 2, reserved: 0, lowStockAt: 3 },
};

describe('listing params', () => {
  it('parses sizes, colours, rupee prices and sort; drops junk', () => {
    const r = parseListingParams({ size: 'm,xq', colour: ['Ink'], min: '1000', max: '', sort: 'price-asc' });
    expect(r.filters).toEqual({ sizes: ['M'], colours: ['ink'], minPrice: 100000, maxPrice: undefined });
    expect(r.sort).toBe('price-asc');
    expect(parseListingParams({ sort: 'evil' }).sort).toBe('featured');
  });
  it('toggles a value in an href', () => {
    expect(listingHref('/shop', { size: 'S', sort: 'new' }, 'size', 'M', true)).toBe('/shop?sort=new&size=S%2CM');
    expect(listingHref('/shop', { size: 'S' }, 'size', 'S', true)).toBe('/shop');
  });
});

describe('filter + sort', () => {
  it('size filter needs stock; sold-out stays without filter', () => {
    expect(filterProducts([a, b, c], inv, { sizes: ['S'], colours: [] }).map((p) => p.id)).toEqual(['pant']);
    expect(filterProducts([a, b, c], inv, { sizes: [], colours: [] })).toHaveLength(3);
    expect(isSoldOut(c, inv)).toBe(true);
  });
  it('filters by colour and price', () => {
    expect(filterProducts([a, b, c], inv, { sizes: [], colours: ['bone'] }).map((p) => p.id)).toEqual(['pant']);
    expect(filterProducts([a, b, c], inv, { sizes: [], colours: [], minPrice: 200000, maxPrice: 300000 }).map((p) => p.id)).toEqual(['tee']);
  });
  it('sorts and sinks sold-out', () => {
    expect(sortProducts([a, b, c], 'price-asc').map((p) => p.id)).toEqual(['cap', 'tee', 'pant']);
    expect(sortProducts([a, b, c], 'price-desc').map((p) => p.id)).toEqual(['pant', 'tee', 'cap']);
    expect(sortProducts([a, b, c], 'new').map((p) => p.id)[0]).toBe('tee');
    expect(sortProducts([a, b, c], 'featured', inv).map((p) => p.id)).toEqual(['pant', 'tee', 'cap']);
  });
  it('derives facets', () => {
    expect(facets([a, b]).colours.map((x) => x.name)).toEqual(['Ink', 'Bone']);
    expect(facets([a, b]).sizes).toEqual(['S', 'M']);
  });
});

describe('pricing', () => {
  it('shows compareAt only while the sale is live', () => {
    const s = mk({ id: 'sale', price: 100000, compareAtPrice: 150000, saleEndsAt: '2026-06-01T00:00:00Z' });
    expect(variantPrice(s, undefined, new Date('2026-05-01'))).toEqual({ amount: 100000, compareAt: 150000 });
    expect(variantPrice(s, undefined, new Date('2026-07-01'))).toEqual({ amount: 100000 });
  });
});

describe('search', () => {
  const idx = buildSearchIndex([a, b, c], { bottoms: 'Bottoms' });
  it('requires all tokens and ranks title hits first', () => {
    expect(searchIndex(idx, 'pant').map((e) => e.slug)).toEqual(['pant']);
    expect(searchIndex(idx, 'bottoms bone').map((e) => e.slug)).toEqual(['pant']);
    expect(searchIndex(idx, 'ink').map((e) => e.slug)).toEqual(['tee', 'cap']);
    expect(searchIndex(idx, '   ')).toEqual([]);
  });
});

describe('size guide + drops + look', () => {
  it('converts cm to inches', () => {
    expect(cmToIn(116)).toBe(45.7);
    const t = sizeChartTable({ id: 'c', name: 'x', measurements: ['chest', 'sleeve'], rows: [{ size: 'M', values: { chest: 116 } }], modelNote: '' }, 'in');
    expect(t).toEqual([{ size: 'M', values: [45.7, null] }]);
  });
  it('counts down and clamps at zero', () => {
    expect(countdownParts(new Date('2026-01-02T01:02:03Z'), new Date('2026-01-01T00:00:00Z'))).toEqual({ days: 1, hours: 1, minutes: 2, seconds: 3, done: false });
    expect(countdownParts(new Date(0), new Date(1000)).done).toBe(true);
  });
  it('complete the look prefers relatedIds then cross-category collection mates', () => {
    const t = { ...a, relatedIds: ['cap'] };
    expect(completeTheLook(t, [t, b, c]).map((p) => p.id)).toEqual(['cap', 'pant']);
  });
});
