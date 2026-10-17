import { describe, expect, it } from 'vitest';
import { depositAmount, heroPresaleProduct, quickBuyAction } from './quick-buy';
import type { PublicProduct } from '@/lib/launches';

const base = { price: 329900, colours: [{ images: [{ id: 'x' }] }] };
const mk = (launch: object) => ({ ...base, launch }) as unknown as PublicProduct;

describe('quick-buy', () => {
  it('parses deposit labels', () => {
    expect(depositAmount('₹999 deposit', 329900)).toBe(99900);
    expect(depositAmount('₹1,499 deposit', 329900)).toBe(149900);
    expect(depositAmount('20% deposit', 329900)).toBe(65980);
    expect(depositAmount('weird', 1)).toBeUndefined();
  });
  it('labels deposit and full presale', () => {
    const dep = mk({ state: 'presale', presale: { paymentMode: 'deposit', deposit: { label: '₹999 deposit', ctaLabel: 'Book' } } });
    expect(quickBuyAction(dep)).toEqual({ mode: 'deposit', label: 'Reserve for ₹999' });
    const full = mk({ state: 'presale', presale: { ctaLabel: 'Pre-order' } });
    expect(quickBuyAction(full).mode).toBe('full');
    expect(quickBuyAction(full).label).toMatch(/^Pre-order ₹3,299/);
  });
  it('picks only open presale products', () => {
    const soon = mk({ state: 'coming_soon' });
    const pre = mk({ state: 'presale', presale: {} });
    expect(heroPresaleProduct([soon, pre])).toBe(pre);
    expect(heroPresaleProduct([soon])).toBeUndefined();
  });
});
