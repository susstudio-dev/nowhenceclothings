import { describe, expect, it } from 'vitest';
import type { Coupon } from '@/lib/schemas/coupons';
import type { Product } from '@/lib/schemas/catalogue';
import { checkCoupon, couponDiscount, findCoupon, priceCart, shippingFee, unitPriceFor } from './pricing';

const NOW = new Date('2026-10-17T00:00:00Z');
const settings = { shipping: { flatFee: 9900, freeShippingThreshold: 299900, eta: '' } };

function product(over: Partial<Product> = {}): Product {
  return {
    id: 'p1', slug: 'tee', title: 'Tee', description: '', categoryId: 'c', collectionIds: [], status: 'active',
    price: 149900, colours: [{ id: 'blk', name: 'Black', hex: '#000000', images: [] }], sizes: ['M'],
    variants: [{ sku: 'TEE-BLK-M', colourId: 'blk', size: 'M' }], fabric: '', care: '', fit: '',
    sizeChartId: 'sc', relatedIds: [], sortOrder: 0, seo: {}, createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(),
    ...over,
  };
}
const base = { id: 'c1', description: '', active: true, minOrder: 0, usedCount: 0, createdAt: NOW.toISOString() };
const pct = (o: Record<string, unknown> = {}) => ({ ...base, code: 'TEN', type: 'percent', value: 10, ...o }) as Coupon;
const flat = (o: Record<string, unknown> = {}) => ({ ...base, code: 'FLAT', type: 'flat', value: 50000, ...o }) as Coupon;
const ship = (o: Record<string, unknown> = {}) => ({ ...base, code: 'SHIP', type: 'free_shipping', ...o }) as Coupon;

describe('unitPriceFor (C3)', () => {
  const p = product();
  const v = p.variants[0]!;
  it('uses product price', () => expect(unitPriceFor(p, v, NOW)).toEqual({ unitPrice: 149900, onSale: false }));
  it('variant override wins', () => expect(unitPriceFor(p, { ...v, priceOverride: 159900 }, NOW).unitPrice).toBe(159900));
  it('active sale shows compareAt', () =>
    expect(unitPriceFor(product({ compareAtPrice: 199900 }), v, NOW)).toEqual({
      unitPrice: 149900,
      compareAtPrice: 199900,
      onSale: true,
    }));
  it('future end date keeps sale', () =>
    expect(unitPriceFor(product({ compareAtPrice: 199900, saleEndsAt: '2026-12-01T00:00:00Z' }), v, NOW).onSale).toBe(true));
  it('ended sale reverts to compareAt', () =>
    expect(unitPriceFor(product({ compareAtPrice: 199900, saleEndsAt: '2026-10-01T00:00:00Z' }), v, NOW)).toEqual({
      unitPrice: 199900,
      onSale: false,
    }));
  it('ignores compareAt <= price', () => expect(unitPriceFor(product({ compareAtPrice: 149900 }), v, NOW).onSale).toBe(false));
  it('variant compareAt override', () =>
    expect(unitPriceFor(p, { ...v, compareAtPriceOverride: 179900 }, NOW).compareAtPrice).toBe(179900));
});

describe('checkCoupon (C4)', () => {
  it('accepts a valid coupon', () => expect(checkCoupon(pct(), 100, NOW)).toEqual({ ok: true }));
  it('missing', () => expect(checkCoupon(undefined, 100, NOW)).toEqual({ ok: false, reason: 'not_found' }));
  it('inactive', () => expect(checkCoupon(pct({ active: false }), 100, NOW)).toMatchObject({ reason: 'inactive' }));
  it('not started', () =>
    expect(checkCoupon(pct({ startsAt: '2026-11-01T00:00:00Z' }), 100, NOW)).toMatchObject({ reason: 'not_started' }));
  it('expired', () => expect(checkCoupon(pct({ expiresAt: '2026-10-01T00:00:00Z' }), 100, NOW)).toMatchObject({ reason: 'expired' }));
  it('expires exactly now', () => expect(checkCoupon(pct({ expiresAt: NOW.toISOString() }), 100, NOW)).toMatchObject({ reason: 'expired' }));
  it('usage limit', () => expect(checkCoupon(pct({ usageLimit: 5, usedCount: 5 }), 100, NOW)).toMatchObject({ reason: 'usage_limit' }));
  it('under limit ok', () => expect(checkCoupon(pct({ usageLimit: 5, usedCount: 4 }), 100, NOW).ok).toBe(true));
  it('min order', () => expect(checkCoupon(pct({ minOrder: 200 }), 199, NOW)).toMatchObject({ reason: 'min_order' }));
  it('min order boundary', () => expect(checkCoupon(pct({ minOrder: 200 }), 200, NOW).ok).toBe(true));
});

describe('couponDiscount', () => {
  it('percent floors', () => expect(couponDiscount(pct({ value: 15 }), 99999)).toBe(14999));
  it('percent cap', () => expect(couponDiscount(pct({ maxDiscount: 10000 }), 500000)).toBe(10000));
  it('100% equals subtotal', () => expect(couponDiscount(pct({ value: 100 }), 12345)).toBe(12345));
  it('flat clamps to subtotal', () => expect(couponDiscount(flat(), 30000)).toBe(30000));
  it('flat', () => expect(couponDiscount(flat(), 300000)).toBe(50000));
  it('free shipping has no discount', () => expect(couponDiscount(ship(), 300000)).toBe(0));
});

describe('shippingFee', () => {
  it('empty cart is free', () => expect(shippingFee(0, settings)).toBe(0));
  it('below threshold pays flat', () => expect(shippingFee(299899, settings)).toBe(9900));
  it('at threshold is free', () => expect(shippingFee(299900, settings)).toBe(0));
});

describe('priceCart (C5)', () => {
  const p = product();
  const v = p.variants[0]!;
  it('sums lines + shipping', () => {
    const b = priceCart({ lines: [{ product: p, variant: v, qty: 2 }], settings, now: NOW });
    expect(b).toMatchObject({ subtotal: 299800, discount: 0, shipping: 9900, total: 309700, freeShippingRemaining: 100 });
    expect(b.lines[0]).toMatchObject({ sku: 'TEE-BLK-M', qty: 2, lineTotal: 299800 });
  });
  it('free shipping over threshold', () => {
    const b = priceCart({ lines: [{ product: p, variant: v, qty: 3 }], settings, now: NOW });
    expect(b).toMatchObject({ subtotal: 449700, shipping: 0, total: 449700, freeShippingRemaining: 0 });
  });
  it('percent coupon; shipping uses the pre-discount subtotal', () => {
    const b = priceCart({ lines: [{ product: p, variant: v, qty: 2 }], settings, couponCode: 'ten', coupon: pct(), now: NOW });
    expect(b).toMatchObject({ discount: 29980, shipping: 9900, total: 299800 - 29980 + 9900, couponCode: 'TEN' });
  });
  it('free shipping coupon', () => {
    const b = priceCart({ lines: [{ product: p, variant: v, qty: 1 }], settings, couponCode: 'SHIP', coupon: ship(), now: NOW });
    expect(b).toMatchObject({ discount: 0, shipping: 0, total: 149900 });
  });
  it('rejected coupon is reported and ignored', () => {
    const b = priceCart({
      lines: [{ product: p, variant: v, qty: 1 }],
      settings,
      couponCode: 'FLAT',
      coupon: flat({ minOrder: 499900 }),
      now: NOW,
    });
    expect(b).toMatchObject({ discount: 0, total: 159800, couponError: 'min_order' });
    expect(b.couponCode).toBeUndefined();
  });
  it('unknown code', () => {
    expect(priceCart({ lines: [{ product: p, variant: v, qty: 1 }], settings, couponCode: 'NOPE', now: NOW }).couponError).toBe('not_found');
  });
  it('blank code is not an error', () => {
    expect(priceCart({ lines: [{ product: p, variant: v, qty: 1 }], settings, couponCode: '  ', now: NOW }).couponError).toBeUndefined();
  });
  it('rejects bad qty', () => {
    expect(() => priceCart({ lines: [{ product: p, variant: v, qty: 0 }], settings, now: NOW })).toThrow();
    expect(() => priceCart({ lines: [{ product: p, variant: v, qty: 1.5 }], settings, now: NOW })).toThrow();
  });
  it('all amounts are integers and total never negative', () => {
    const b = priceCart({
      lines: [{ product: product({ price: 333 }), variant: v, qty: 3 }],
      settings,
      couponCode: 'TEN',
      coupon: pct({ value: 33 }),
      now: NOW,
    });
    for (const n of [b.subtotal, b.discount, b.shipping, b.total]) expect(Number.isInteger(n)).toBe(true);
    expect(b.total).toBeGreaterThanOrEqual(0);
  });
  it('findCoupon is case-insensitive', () => {
    expect(findCoupon([pct()], ' ten ')?.code).toBe('TEN');
    expect(findCoupon([pct()], undefined)).toBeUndefined();
  });
});
