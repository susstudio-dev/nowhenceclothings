import { describe, expect, it } from 'vitest';
import type { LaunchView, PublicProduct } from '@/lib/launches';
import {
  countdownFor,
  depositSummary,
  depositTodayLine,
  heroDepositLine,
  pieceName,
  preorderFaq,
  preorderShipLine,
  preorderShipSentence,
  preorderTrustLine,
  presaleNoteCopy,
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
    expect(depositTodayLine(depositSummary(polo())!)).toBe('Reserve today for ₹500 · Pay ₹999 when the sale opens on 31 Oct, 10:00 am IST');
    expect(depositTodayLine(depositSummary(polo({ saleStartsAt: undefined }))!)).toBe('Reserve today for ₹500 · Pay ₹999 when the sale opens');
    expect(depositTodayLine(depositSummary(polo({ priceLock: 'sale' }))!)).toBe('Reserve today for ₹500 · Pay the balance at the sale price when the sale opens on 31 Oct, 10:00 am IST');
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

describe('pre-order trust copy', () => {
  const SHIP = 'Limited first run of 100. Orders ship within 2–3 weeks of the sale opening.';
  const reserve = (dep: object = {}, pre: object = {}) =>
    ({
      price: 149900,
      launch: launch({
        presale: presale({
          shipCopy: SHIP,
          cap: 100,
          paymentMode: 'deposit',
          deposit: { label: '₹500', ctaLabel: 'Reserve', amount: 50000, saleStartsAt: SALE, priceLock: 'booking', balanceWindowDays: 7, refundable: false, unpaidOutcome: 'manual', ...dep },
          ...pre,
        }),
      }),
    }) as Pick<PublicProduct, 'price' | 'launch'>;
  const ctx = { exchange: { days: 7 } };

  it('trust line under the button', () => {
    expect(preorderTrustLine(reserve(), ctx)).toBe(
      'Limited first run of 100. Reservations are non-refundable. Orders ship within 2–3 weeks of the sale opening. One free size exchange. Limit 2 per customer.',
    );
  });

  it('ship sentence: date, then owner copy, then a fallback', () => {
    expect(preorderShipSentence(reserve())).toBe('Orders ship within 2–3 weeks of the sale opening.');
    expect(preorderShipSentence(reserve({}, { shipBy: '2026-11-21' }))).toBe('Ships by 21 November.');
    expect(preorderShipSentence(reserve({}, { shipCopy: 'Limited first run.' }))).toBe('Ships after the sale opens.');
  });

  it('answers the pre-order questions in plain terms', () => {
    const faq = preorderFaq(reserve(), ctx);
    expect(faq.map((x) => x.q)).toEqual(['How does the pre-order work?', 'Can I cancel a reservation?', 'When does it ship?', 'Can I change my size?']);
    expect(faq[0].a).toBe(
      "Pay ₹500 today to reserve your piece and size. When the sale opens on 31 October at 10:00 am IST, we'll send you a link to pay the ₹999 balance within 7 days. Orders ship within 2–3 weeks of the sale opening.",
    );
    expect(faq[1].a).toBe("This is a limited run of 100, so reservations are non-refundable. If the size isn't right when it arrives, we'll exchange it once for free.");
    expect(faq[2].a).toBe('Orders ship within 2–3 weeks of the sale opening. Delivery then takes 2–6 working days, depending on your PIN code.');
    expect(faq[3].a).toContain('one free size exchange within 7 days');
  });

  it('says refundable when it is', () => {
    expect(preorderFaq(reserve({ refundable: true }))[1].a).toBe("Yes. Write to us before you pay the balance and we'll refund your ₹500.");
  });

  it('is empty outside a presale', () => {
    expect(preorderFaq({ price: 1, launch: launch({ state: 'available' }) })).toEqual([]);
    expect(preorderTrustLine({ launch: launch({ state: 'available' }) })).toBe('');
  });

  it('names the piece for sentences', () => {
    expect(pieceName('The Panther Polo')).toBe('the Panther');
    expect(pieceName('Ring Polo')).toBe('Ring');
  });
});

describe('presaleNoteCopy', () => {
  it('home strip names the run and the opening', () => {
    const p = {
      title: 'The Panther Polo',
      price: 149900,
      launch: launch({
        presale: presale({ cap: 100, paymentMode: 'deposit', deposit: { label: '₹500', ctaLabel: 'Reserve', amount: 50000, saleStartsAt: SALE, priceLock: 'booking' } }),
      }),
    };
    expect(presaleNoteCopy(p)).toEqual({
      heading: 'The first run: 100 pieces.',
      body: 'The Panther opens on 31 October at 10:00 am IST. Reserve yours for ₹500 today. Pay the ₹999 balance when the sale opens.',
    });
    expect(presaleNoteCopy({ ...p, launch: launch({ state: 'available' }) })).toBeNull();
  });
});
