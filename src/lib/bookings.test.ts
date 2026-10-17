import { describe, expect, it } from 'vitest';
import {
  BOOKING_CSV_HEADER,
  BookingError,
  balanceDeadline,
  bookingMonthForNumber,
  bookingTotals,
  bookingUnitPrice,
  bookingWindow,
  bookingsToCsv,
  computeBalance,
  depositAmount,
  depositPerUnit,
  dueTransition,
  filterBookings,
  finalUnitPrice,
  hashBookingToken,
  newBookingNumber,
  newBookingToken,
  startBalanceDue,
  TOKEN_RE,
  withBookingStatus,
} from './bookings';
import { BOOKING_STATUSES, BOOKING_TRANSITIONS, Booking, BookingNumber, canBookingTransition, summarizeBooking } from './schemas/bookings';
import { LaunchDefaults } from './schemas/launches';
import type { Product } from './schemas/catalogue';
import { toPublicProduct } from './launches';

const d = LaunchDefaults.parse({});
const T0 = '2026-10-01T00:00:00.000Z';
const SALE = '2026-11-15T04:30:00.000Z';

function product(over: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    slug: 'ring-polo',
    title: 'Ring Polo',
    description: 'secret description',
    categoryId: 'c',
    collectionIds: [],
    status: 'active',
    price: 379900,
    colours: [{ id: 'black', name: 'Black', hex: '#000000', images: [] }],
    sizes: ['M', 'L'],
    variants: [
      { sku: 'PRE-BLK-M', colourId: 'black', size: 'M' },
      { sku: 'PRE-BLK-L', colourId: 'black', size: 'L', priceOverride: 399900 },
    ],
    fabric: '',
    care: '',
    fit: '',
    sizeChartId: 's',
    relatedIds: [],
    sortOrder: 0,
    seo: {},
    availability: 'presale',
    presale: {
      enabled: true,
      startsAt: T0,
      endsAt: SALE,
      price: 329900,
      cap: 3,
      perCustomerLimit: 2,
      paymentMode: 'deposit',
      deposit: { depositType: 'fixed', depositValue: 99900, saleStartsAt: SALE, balanceWindowDays: 7 },
    },
    createdAt: T0,
    updatedAt: T0,
    ...over,
  };
}

function booking(over: Partial<Booking> = {}): Booking {
  return Booking.parse({
    id: 'b1',
    number: 'NWB-261020-ABCD',
    status: 'deposit_paid',
    email: 'a@b.co',
    name: 'Asha Rao',
    phone: '9876543210',
    productId: 'p1',
    productSlug: 'ring-polo',
    productTitle: 'Ring Polo',
    sku: 'PRE-BLK-M',
    colour: 'Black',
    size: 'M',
    qty: 1,
    lockedUnitPrice: 329900,
    deposit: 99900,
    terms: { priceLock: 'booking', depositRefundable: false, unpaidOutcome: 'forfeit', saleStartsAt: SALE, balanceWindowDays: 7 },
    tokenHashes: [],
    depositRazorpayOrderId: 'order_X',
    history: [{ at: '2026-10-20T00:00:00.000Z', status: 'deposit_pending', by: 'customer' }],
    createdAt: '2026-10-20T00:00:00.000Z',
    updatedAt: '2026-10-20T00:00:00.000Z',
    ...over,
  });
}

const shipping = { shipping: { flatFee: 9900, freeShippingThreshold: 500000, eta: '' } };

describe('deposit math', () => {
  it('fixed deposit, clamped to the unit price', () => {
    expect(depositPerUnit(329900, { depositType: 'fixed', depositValue: 99900 })).toBe(99900);
    expect(depositPerUnit(50000, { depositType: 'fixed', depositValue: 99900 })).toBe(50000);
    expect(depositAmount(329900, 2, { depositType: 'fixed', depositValue: 99900 })).toBe(199800);
  });
  it('percent deposit rounds to whole paise', () => {
    expect(depositPerUnit(329900, { depositType: 'percent', depositValue: 20 })).toBe(65980);
    expect(depositPerUnit(333333, { depositType: 'percent', depositValue: 33 })).toBe(110000);
    expect(depositPerUnit(100000, { depositType: 'percent', depositValue: 100 })).toBe(100000);
    expect(Number.isInteger(depositAmount(129999, 3, { depositType: 'percent', depositValue: 15 }))).toBe(true);
  });
  it('booking unit price = presale price, else the live variant price', () => {
    const p = product();
    expect(bookingUnitPrice(p, p.variants[0]!, { price: 329900 }, new Date())).toBe(329900);
    expect(bookingUnitPrice(p, p.variants[1]!, { price: undefined }, new Date())).toBe(399900);
  });
});

describe('balance math + price lock', () => {
  const p = product({ price: 419900, presale: undefined });
  const live = { product: p, variant: p.variants[0]!, now: new Date(SALE) };
  it('priceLock booking keeps the booking price', () => {
    const b = booking();
    expect(finalUnitPrice(b, live)).toBe(329900);
    expect(computeBalance(b, finalUnitPrice(b, live), shipping)).toEqual({
      finalUnitPrice: 329900, subtotal: 329900, deposit: 99900, shipping: 9900, balance: 329900 - 99900 + 9900,
    });
  });
  it('priceLock sale uses the frozen sale-start price, else the live price', () => {
    const b = booking({ terms: { ...booking().terms, priceLock: 'sale' } });
    expect(finalUnitPrice(b, live)).toBe(419900);
    expect(finalUnitPrice({ ...b, finalUnitPrice: 399900 }, live)).toBe(399900);
    expect(finalUnitPrice(b)).toBe(329900); // product gone: falls back to the booking price
  });
  it('free shipping over the threshold; deposit never exceeds the subtotal', () => {
    const b = booking({ qty: 2, deposit: 199800 });
    expect(computeBalance(b, 329900, shipping)).toMatchObject({ subtotal: 659800, shipping: 0, balance: 460000 });
    expect(computeBalance(booking({ deposit: 999999 }), 329900, shipping).balance).toBe(9900);
  });
  it('startBalanceDue freezes price + deadline per lock', () => {
    const now = new Date(SALE);
    const a = startBalanceDue(booking(), 419900, now);
    expect(a).toMatchObject({ status: 'balance_due', finalUnitPrice: 329900, balanceDueBy: balanceDeadline(SALE, 7) });
    const s = startBalanceDue(booking({ terms: { ...booking().terms, priceLock: 'sale' } }), 419900, now);
    expect(s.finalUnitPrice).toBe(419900);
    expect(balanceDeadline(SALE, 7)).toBe('2026-11-22T04:30:00.000Z');
  });
});

describe('tokens + numbers', () => {
  it('token is 32 random bytes base64url and unique', () => {
    const a = newBookingToken();
    const b = newBookingToken();
    expect(a).toMatch(TOKEN_RE);
    expect(a).not.toBe(b);
    expect(Buffer.from(a, 'base64url').length).toBe(32);
  });
  it('stores only a SHA-256 hex hash', async () => {
    const h = await hashBookingToken('abc');
    expect(h).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    const tok = newBookingToken();
    expect(await hashBookingToken(tok)).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashBookingToken(tok)).not.toContain(tok);
  });
  it('NWB-YYMMDD-XXXX', () => {
    const n = newBookingNumber(new Date('2026-10-20T10:00:00Z'));
    expect(BookingNumber.safeParse(n).success).toBe(true);
    expect(n.startsWith('NWB-261020-')).toBe(true);
    expect(bookingMonthForNumber(n)).toBe('2026-10');
  });
});

describe('transitions', () => {
  it('table matches the A13 state machine', () => {
    expect(BOOKING_TRANSITIONS.deposit_pending).toEqual(['deposit_paid', 'cancelled']);
    expect(BOOKING_TRANSITIONS.deposit_paid).toEqual(['balance_due', 'cancelled', 'refunded']);
    expect(BOOKING_TRANSITIONS.balance_due).toContain('completed');
    expect(BOOKING_TRANSITIONS.balance_due).toContain('expired');
    expect(BOOKING_TRANSITIONS.completed).toEqual([]);
    expect(BOOKING_TRANSITIONS.refunded).toEqual([]);
  });
  it('every allowed transition applies with history; every other one throws', () => {
    for (const from of BOOKING_STATUSES) {
      for (const to of BOOKING_STATUSES) {
        if (from === to) continue;
        const b = booking({ status: from });
        if (canBookingTransition(from, to)) {
          const n = withBookingStatus(b, to, 'test', 'n', new Date('2026-11-01T00:00:00Z'));
          expect(n.status).toBe(to);
          expect(n.history.at(-1)).toMatchObject({ status: to, by: 'test', note: 'n' });
        } else {
          expect(() => withBookingStatus(b, to, 'test')).toThrow(BookingError);
        }
      }
    }
  });
  it('dueTransition: unpaid deposit, sale start, expiry', () => {
    const created = booking({ status: 'deposit_pending' });
    expect(dueTransition(created, new Date('2026-10-20T00:20:00Z'), 30)).toBeNull();
    expect(dueTransition(created, new Date('2026-10-20T00:31:00Z'), 30)).toEqual({ to: 'cancelled', reason: 'deposit_unpaid' });
    expect(dueTransition(booking(), new Date('2026-11-15T04:29:59Z'), 30)).toBeNull();
    expect(dueTransition(booking(), new Date(SALE), 30)).toEqual({ to: 'balance_due' });
    const due = booking({ status: 'balance_due', balanceDueBy: '2026-11-22T04:30:00.000Z' });
    expect(dueTransition(due, new Date('2026-11-22T04:30:00Z'), 30)).toBeNull();
    expect(dueTransition(due, new Date('2026-11-22T04:30:01Z'), 30)).toEqual({ to: 'expired' });
    for (const s of ['completed', 'expired', 'cancelled', 'refunded'] as const) {
      expect(dueTransition(booking({ status: s }), new Date('2030-01-01T00:00:00Z'), 30)).toBeNull();
    }
  });
});

describe('bookingWindow (secrecy + dates)', () => {
  const at = (iso: string) => new Date(iso);
  it('open inside the window', () => {
    const w = bookingWindow(product(), [], d, at('2026-10-20T00:00:00Z'));
    expect(w.state).toBe('open');
  });
  it('closed at sale start and after bookingClosesAt', () => {
    expect(bookingWindow(product(), [], d, at(SALE)).state).not.toBe('open');
    const p = product();
    p.presale!.deposit!.bookingClosesAt = '2026-10-25T00:00:00.000Z';
    expect(bookingWindow(p, [], d, at('2026-10-26T00:00:00Z')).state).toBe('closed');
  });
  it('not_open before bookingOpensAt', () => {
    const p = product();
    p.presale!.deposit!.bookingOpensAt = '2026-10-25T00:00:00.000Z';
    expect(bookingWindow(p, [], d, at('2026-10-20T00:00:00Z'))).toMatchObject({ state: 'not_open', opensAt: '2026-10-25T00:00:00.000Z' });
  });
  it('hidden (404) for coming-soon, draft, full-payment presale or no presale — nothing leaks', () => {
    const now = at('2026-10-20T00:00:00Z');
    expect(bookingWindow(product({ availability: 'coming_soon' }), [], d, now).state).toBe('hidden');
    expect(bookingWindow(product({ status: 'draft' }), [], d, now).state).toBe('hidden');
    const full = product();
    full.presale!.paymentMode = 'full';
    expect(bookingWindow(full, [], d, now).state).toBe('hidden');
    expect(bookingWindow(product({ presale: undefined, availability: 'available' }), [], d, now).state).toBe('hidden');
    // and a hidden coming-soon product's storefront projection never carries the deposit terms or secrets
    const pub = toPublicProduct(product({ availability: 'coming_soon' }), [], d, now);
    expect(JSON.stringify(pub)).not.toContain('secret description');
    expect(JSON.stringify(pub)).not.toContain('deposit');
  });
  it('drop-level deposit presale is inherited', () => {
    const p = product({ presale: undefined, availability: 'available', dropId: 'd1' });
    const drop = {
      id: 'd1', name: 'D', slug: 'd', releaseAt: T0, description: '', seo: {},
      presale: { enabled: true, startsAt: T0, endsAt: SALE, paymentMode: 'deposit' as const, deposit: { saleStartsAt: SALE } },
    };
    const w = bookingWindow(p, [drop], d, at('2026-10-20T00:00:00Z'));
    expect(w.state).toBe('open');
    if (w.state === 'open') expect(w.dep).toMatchObject({ depositType: 'fixed', depositValue: 99900, balanceWindowDays: 7, priceLock: 'booking' });
  });
  it('presale projection advertises the booking CTA', () => {
    const pub = toPublicProduct(product(), [], d, at('2026-10-20T00:00:00Z'));
    expect(pub.launch.presale).toMatchObject({ paymentMode: 'deposit', deposit: { label: '₹999 deposit', saleStartsAt: SALE } });
  });
});

describe('admin list helpers', () => {
  const rows = [
    summarizeBooking(booking({ id: 'a', status: 'deposit_paid', depositPaymentId: 'pay_1' })),
    summarizeBooking(booking({ id: 'b', status: 'refunded', depositPaymentId: 'pay_2', email: 'z@y.co' })),
    summarizeBooking(booking({ id: 'c', status: 'deposit_pending' })),
  ];
  it('filters and totals deposits collected (paid, not refunded)', () => {
    expect(filterBookings(rows, { status: 'refunded' }).map((r) => r.id)).toEqual(['b']);
    expect(filterBookings(rows, { q: 'z@y' }).map((r) => r.id)).toEqual(['b']);
    expect(bookingTotals(rows)).toMatchObject({ count: 3, depositsCollected: 99900 });
  });
  it('CSV escapes and guards formulas', () => {
    const csv = bookingsToCsv([{ ...rows[0]!, name: '=HYPERLINK("x")' }]);
    const [head, line] = csv.trim().split('\r\n');
    expect(head).toBe(BOOKING_CSV_HEADER.join(','));
    expect(line).toContain(`"'=HYPERLINK(""x"")"`);
    expect(line).toContain('999.00');
  });
});
