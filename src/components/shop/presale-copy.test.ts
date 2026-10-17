import { describe, expect, it } from 'vitest';
import type { LaunchView, PublicProduct } from '@/lib/launches';
import {
  countdownFor,
  depositSummary,
  depositTodayLine,
  heroDepositLine,
  preorderShipLine,
  reserveHowItWorks,
} from './presale-copy';

const SALE = '2026-10-31T04:30:00.000Z';
const presale = (over: Partial<NonNullable<LaunchView['presale']>> = {}): LaunchView['presale'] => ({
  shipCopy: '',
  access: 'public',
  terms: '',
  ctaLabel: 'Pre-order',
  perCustomerLimit: 2,
  ...over,
});
const launch = (over: Partial<LaunchView> = {}): LaunchView => ({
  state: 'presale',
  titleHidden: false,
  priceHidden: false,
  blurred: false,
  notify: false,
  ...over,
});
const polo = (dep: object = {}, price = 149900) =>
  ({
    price,
    launch: launch({
      nextChangeAt: SALE,
      presale: presale({
        paymentMode: 'deposit',
        deposit: { label: '₹500 deposit', ctaLabel: 'Pre-book', saleStartsAt: SALE, amount: 50000, priceLock: 'booking', balanceWindowDays: 7, ...dep },
      }),
    }),
  }) as Pick<PublicProduct, 'price' | 'launch'>;

describe('deposit copy (live polo: ₹1,499, ₹500 fixed deposit, sale 31 Oct)', () => {
  it('derives the amounts from config', () => {
    expect(depositSummary(polo())).toEqual({ price: 149900, deposit: 50000, balance: 99900, priceLock: 'booking', saleStartsAt: SALE, balanceWindowDays: 7 });
  });
  it('falls back to the label when no amount is projected', () => {
    expect(depositSummary(polo({ amount: undefined, label: '20% deposit' }))?.deposit).toBe(29980);
  });
  it('is undefined for full-payment presale and available products', () => {
    expect(depositSummary({ price: 1, launch: launch({ presale: presale() }) })).toBeUndefined();
    expect(depositSummary({ price: 1, launch: launch({ state: 'available' }) })).toBeUndefined();
  });
  it('hero line', () => {
    expect(heroDepositLine(depositSummary(polo())!)).toBe('₹500 to reserve · ₹999 when the sale opens');
    expect(heroDepositLine(depositSummary(polo({ priceLock: 'sale' }))!)).toBe('₹500 to reserve · the balance at the sale price when the sale opens');
  });
  it('product page line', () => {
    expect(depositTodayLine(depositSummary(polo())!)).toBe('₹500 today · ₹999 balance when the sale opens on 31 Oct');
    expect(depositTodayLine(depositSummary(polo({ saleStartsAt: undefined }))!)).toBe('₹500 today · ₹999 balance when the sale opens');
    expect(depositTodayLine(depositSummary(polo({ priceLock: 'sale' }))!)).toBe('₹500 today · the balance at the sale price when the sale opens on 31 Oct');
  });
  it('reserve sheet explains the balance per price lock', () => {
    const q = { deposit: 50000, unitPrice: 149900, qty: 1, priceLock: 'booking' as const, saleStartsAt: SALE, balanceWindowDays: 7 };
    expect(reserveHowItWorks(q)).toBe(
      'Pay ₹500 now. When the sale opens on 31 October, we email a private link to pay the remaining ₹999 (plus shipping if any) within 7 days.',
    );
    expect(reserveHowItWorks({ ...q, qty: 2, deposit: 100000 })).toContain('the remaining ₹1,998 (plus shipping if any)');
    expect(reserveHowItWorks({ ...q, priceLock: 'sale', saleStartsAt: undefined })).toBe(
      'Pay ₹500 now. When the sale opens, we email a private link to pay the balance at the sale price (plus shipping if any) within 7 days.',
    );
    expect(reserveHowItWorks(q)).not.toMatch(/today/);
  });
});

describe('countdownFor', () => {
  it('pre-booking counts down to the sale opening', () => {
    expect(countdownFor(polo().launch)).toEqual({ label: 'Sale opens', at: SALE });
  });
  it('pre-booking without a sale date counts down to bookings closing', () => {
    expect(countdownFor(polo({ saleStartsAt: undefined }).launch)).toEqual({ label: 'Bookings close', at: SALE });
  });
  it('full-payment presale counts down to pre-orders closing', () => {
    expect(countdownFor(launch({ nextChangeAt: SALE, presale: presale() }))).toEqual({ label: 'Pre-orders close', at: SALE });
  });
  it('coming soon keeps "Releases"', () => {
    expect(countdownFor(launch({ state: 'coming_soon', nextChangeAt: SALE }))).toEqual({ label: 'Releases', at: SALE });
    expect(countdownFor(launch({ state: 'coming_soon' }))).toBeUndefined();
  });
});

describe('preorderShipLine', () => {
  const fmt = (d: string) => (d === '2026-12-15' ? '15 Dec 2026' : d);
  it('does not repeat the date the copy already carries', () => {
    expect(preorderShipLine('2026-12-15', 'Made to order. Ships by 15 December 2026.', fmt)).toBe('Made to order. Ships by 15 December 2026.');
  });
  it('prefixes the date when the copy has none', () => {
    expect(preorderShipLine('2026-12-15', 'Made to order.', fmt)).toBe('Ships by 15 Dec 2026. Made to order.');
    expect(preorderShipLine('2026-12-15', '', fmt)).toBe('Ships by 15 Dec 2026.');
  });
  it('without a date it is just the copy', () => {
    expect(preorderShipLine(undefined, 'Made to order.', fmt)).toBe('Made to order.');
  });
});
