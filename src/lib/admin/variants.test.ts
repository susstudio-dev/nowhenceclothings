import { describe, expect, it } from 'vitest';
import { Variant } from '@/lib/schemas/catalogue';
import { buildVariantGrid, removedSkus, skuFor, sortSizes } from './variants';

describe('skuFor', () => {
  it('builds a valid upper-case SKU', () => {
    expect(skuFor('tee-heavyweight', 'bone', 'M')).toBe('TEE-HEAVYWEIGHT-BONE-M');
    expect(() => Variant.shape.sku.parse(skuFor('x', 'y', 'XXL'))).not.toThrow();
  });
  it('stays within 40 chars and keeps colour+size', () => {
    const s = skuFor('a-very-long-product-slug-that-goes-on-and-on-forever', 'midnight-blue', 'XXL');
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s.endsWith('-MIDNIGHT-BLUE-XXL')).toBe(true);
    expect(() => Variant.shape.sku.parse(s)).not.toThrow();
  });
});

describe('buildVariantGrid', () => {
  const colours = [{ id: 'bone' }, { id: 'ink' }];
  it('creates colours x sizes in canonical size order', () => {
    const g = buildVariantGrid('tee', colours, ['L', 'S', 'M']);
    expect(g).toHaveLength(6);
    expect(g.slice(0, 3).map((v) => v.size)).toEqual(['S', 'M', 'L']);
    expect(new Set(g.map((v) => v.sku)).size).toBe(6);
  });
  it('preserves existing SKUs and overrides; drops removed cells', () => {
    const existing = [
      { sku: 'LEGACY-1', colourId: 'bone', size: 'M' as const, priceOverride: 1000 },
      { sku: 'GONE', colourId: 'red', size: 'M' as const },
    ];
    const g = buildVariantGrid('tee', colours, ['M'], existing);
    expect(g.find((v) => v.colourId === 'bone')).toEqual(existing[0]);
    expect(g.find((v) => v.sku === 'GONE')).toBeUndefined();
    expect(removedSkus(existing, g)).toEqual(['GONE']);
  });
  it('sortSizes dedupes into XS..XXL order', () => {
    expect(sortSizes(['XXL', 'XS', 'M', 'M'])).toEqual(['XS', 'M', 'XXL']);
  });
});
