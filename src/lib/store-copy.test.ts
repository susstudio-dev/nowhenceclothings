import { describe, expect, it } from 'vitest';
import { displayPhone, etaSentence, instagramHandle, phoneDigits, sentenceCase, shippingLooksSwapped, shippingSummary, whatsappUrl } from './store-copy';

describe('shippingSummary', () => {
  it('flat fee with no free tier', () => {
    expect(shippingSummary({ flatFee: 9900, freeShippingThreshold: 0 })).toBe('Flat ₹99 shipping on every order.');
  });
  it('flat fee with a free tier', () => {
    expect(shippingSummary({ flatFee: 9900, freeShippingThreshold: 299900 })).toBe('Flat ₹99 shipping. Free on orders of ₹2,999 or more.');
  });
  it('free everywhere when the fee is 0', () => {
    expect(shippingSummary({ flatFee: 0, freeShippingThreshold: 0 })).toBe('Free shipping on every order.');
  });
  it('swapped values never read as "₹1,499 otherwise"', () => {
    const s = { flatFee: 149900, freeShippingThreshold: 9900 };
    expect(shippingSummary(s)).toBe('Free shipping on orders of ₹99 or more.');
    expect(shippingLooksSwapped(s)).toBe(true);
  });
  it('a sane config is not flagged', () => {
    expect(shippingLooksSwapped({ flatFee: 9900, freeShippingThreshold: 299900 })).toBe(false);
    expect(shippingLooksSwapped({ flatFee: 9900, freeShippingThreshold: 0 })).toBe(false);
  });
});

describe('copy helpers', () => {
  it('sentence-cases owner text', () => {
    expect(sentenceCase(' ships in 5 days')).toBe('Ships in 5 days');
    expect(sentenceCase('')).toBe('');
    expect(etaSentence('ships in 5-6 working days.')).toBe('Ships in 5-6 working days');
  });
});

describe('contact helpers', () => {
  it('normalises Indian numbers', () => {
    expect(phoneDigits('9014352958')).toBe('919014352958');
    expect(phoneDigits('+91 90143 52958')).toBe('919014352958');
    expect(phoneDigits('09014352958')).toBe('919014352958');
    expect(phoneDigits('123')).toBe('');
    expect(displayPhone('9014352958')).toBe('+91 90143 52958');
  });
  it('builds WhatsApp links', () => {
    expect(whatsappUrl('9014352958')).toBe('https://wa.me/919014352958');
    expect(whatsappUrl('9014352958', 'Hi, size?')).toBe('https://wa.me/919014352958?text=Hi%2C%20size%3F');
    expect(whatsappUrl('')).toBeUndefined();
  });
  it('reads Instagram handles', () => {
    expect(instagramHandle('nowhence_clothings')).toBe('@nowhence_clothings');
    expect(instagramHandle('https://www.instagram.com/nowhence_clothings/')).toBe('@nowhence_clothings');
    expect(instagramHandle('@x y')).toBe('');
  });
});
