import { describe, expect, it } from 'vitest';
import { addLine, EMPTY_CART, removeLineFrom, setCoupon, updateLineQty } from './cart-core';

describe('cart reducers', () => {
  it('adds and merges lines, clamped to max', () => {
    let s = addLine(EMPTY_CART, { sku: 'A', qty: 1, title: 'Tee' }, 10);
    s = addLine(s, { sku: 'A', qty: 12 }, 10);
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0]).toMatchObject({ sku: 'A', qty: 10, title: 'Tee' });
    s = addLine(s, { sku: 'B', qty: 2 }, 10);
    expect(s.lines.map((l) => l.sku)).toEqual(['A', 'B']);
  });
  it('updates qty; zero removes', () => {
    let s = addLine(EMPTY_CART, { sku: 'A', qty: 1 }, 10);
    s = updateLineQty(s, 'A', 3, 10);
    expect(s.lines[0]!.qty).toBe(3);
    expect(updateLineQty(s, 'A', 0, 10).lines).toHaveLength(0);
    expect(updateLineQty(s, 'A', 99, 10).lines[0]!.qty).toBe(10);
  });
  it('removes and sets coupons', () => {
    const s = addLine(EMPTY_CART, { sku: 'A', qty: 1 }, 10);
    expect(removeLineFrom(s, 'A').lines).toEqual([]);
    expect(setCoupon(s, ' ten ').couponCode).toBe('TEN');
    expect(setCoupon(setCoupon(s, 'X'), '').couponCode).toBeUndefined();
  });
});

describe('wouldMixPresale (A11)', () => {
  it('blocks adding in-stock to a pre-order bag and vice versa', async () => {
    const { wouldMixPresale } = await import('./cart-core');
    const preBag = { lines: [{ sku: 'P', qty: 1, preorder: true }] };
    expect(wouldMixPresale(preBag, { sku: 'S' })).toBe(true);
    expect(wouldMixPresale(preBag, { sku: 'P2', preorder: true })).toBe(false);
    expect(wouldMixPresale({ lines: [{ sku: 'S', qty: 1 }] }, { sku: 'P', preorder: true })).toBe(true);
    expect(wouldMixPresale({ lines: [] }, { sku: 'P', preorder: true })).toBe(false);
  });
});
