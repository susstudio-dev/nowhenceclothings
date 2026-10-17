import { promises as fs } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { deleteKey, readJson, writeJsonCas } from './storage';
import { getCatalogue } from './catalogue';
import { getSettings } from './content';
import type { CatalogueDoc, Product } from './schemas/catalogue';
import type { SettingsDoc } from './schemas/settings';
import { InventoryDoc } from './schemas/inventory';
import { PresaleLedgerDoc } from './schemas/launches';
import { Order, OrdersIndexDoc, orderKey, ordersIndexKey } from './schemas/order';
import { BookingsIndexDoc, bookingsIndexKey, type Booking } from './schemas/bookings';
import { hmacSha256Hex } from './commerce/razorpay';
import {
  BookingError,
  advanceBooking,
  bookingByToken,
  cancelBooking,
  confirmBookingPayment,
  createBooking,
  extendBooking,
  issueBookingToken,
  purgeBookingKeys,
  reapplyAfterCatalogueChange,
  readBooking,
  startBalancePayment,
  sweepBookings,
  type BookingDeps,
} from './bookings-server';

// Integration test on the dev filesystem backend (data/): a test-only product,
// a scratch ledger + inventory key, and cleanup of every key created.
const DATA = process.env.NOWHENCE_DATA_DIR ?? path.join(process.cwd(), 'data');
const LEDGER = '__test__/bookings-ledger.json';
const LEDGER2 = '__test__/bookings-ledger-f23.json';
const STOCK = '__test__/bookings-inventory.json';
const SALE = '2026-11-15T04:30:00.000Z';
const BOOK_AT = new Date('2026-10-20T10:00:00.000Z');
const cfg = { keyId: 'rzp_test_x', keySecret: 'sec', webhookSecret: 'wh' };

const created = new Set<string>();
const orders = new Set<string>();
let catalogue: CatalogueDoc;
let settings: SettingsDoc;
let seq = 0;
const refunds: string[] = [];

const fakeFetch = vi.fn(async (url: string, init: RequestInit) => {
  const body = JSON.parse(init.body as string) as { amount: number };
  if (url.includes('/refund')) {
    refunds.push(url);
    return new Response(JSON.stringify({ id: `rfnd_T${seq++}`, amount: body.amount, status: 'processed' }));
  }
  return new Response(JSON.stringify({ id: `order_B${Date.now()}${seq++}`, amount: body.amount, currency: 'INR', status: 'created' }));
}) as unknown as typeof fetch;

const sent: string[] = [];
const send = vi.fn(async (m: { subject: string }) => {
  sent.push(m.subject);
  return { sent: true as const };
});

function deps(now: Date, over: Partial<BookingDeps> = {}): BookingDeps {
  return { cfg, fetchImpl: fakeFetch, now, ledgerKey: () => LEDGER, stockKey: STOCK, catalogue, settings, send, ...over };
}

function testProduct(base: Product, over: Partial<NonNullable<Product['presale']>['deposit']> = {}): Product {
  return {
    ...base,
    id: 'prod-test-booking',
    slug: 'test-booking-polo',
    title: 'Test Booking Polo',
    status: 'active',
    availability: 'presale',
    price: 379900,
    variants: base.variants.map((v) => ({ sku: v.sku, colourId: v.colourId, size: v.size })),
    presale: {
      enabled: true,
      startsAt: '2026-10-01T00:00:00.000Z',
      endsAt: SALE,
      price: 329900,
      cap: 3,
      perCustomerLimit: 2,
      access: 'public',
      paymentMode: 'deposit',
      deposit: { depositType: 'fixed', depositValue: 99900, saleStartsAt: SALE, balanceWindowDays: 7, priceLock: 'booking', ...over },
    },
  };
}

const input = (email: string, qty = 1, sku?: string) => ({
  slug: 'test-booking-polo',
  sku: sku ?? catalogue.products.find((p) => p.id === 'prod-test-booking')!.variants[0]!.sku,
  qty,
  name: 'Test Booker',
  email,
  phone: '9876543210',
  acceptPolicy: true as const,
});

async function book(email: string, qty = 1, now = BOOK_AT) {
  const res = await createBooking(input(email, qty), deps(now));
  created.add(res.bookingId);
  return res;
}

const address = { name: 'Test Booker', line1: '1 Road', line2: '', city: 'Pune', state: 'Maharashtra', pincode: '411001', country: 'IN' as const };

beforeAll(async () => {
  delete process.env.RESEND_API_KEY;
  const live = await getCatalogue();
  const base = live.products.find((p) => p.variants.length >= 2) ?? live.products[0]!;
  catalogue = { ...live, products: [...live.products.filter((p) => p.id !== 'prod-test-booking'), testProduct(base)] };
  const s = await getSettings();
  settings = { ...s, shipping: { ...s.shipping, flatFee: 9900, freeShippingThreshold: 500000 }, orders: { ...s.orders, paymentWindowMinutes: 30 } };
  const skus = testProduct(base).variants.map((v) => v.sku);
  await writeJsonCas(STOCK, InventoryDoc, () => Object.fromEntries(skus.map((k) => [k, { stock: 5, reserved: 0, lowStockAt: 1 }])), {
    initial: () => ({}),
  });
});

const metaOf = (key: string) => path.join(DATA, '.meta', `${key.replace(/\//g, '__')}.json`);

afterAll(async () => {
  for (const id of created) {
    const b = await readBooking(id);
    if (b) await purgeBookingKeys(b);
    await fs.rm(metaOf(`bookings/${id}.json`), { force: true });
  }
  for (const key of new Set([bookingsIndexKey(BOOK_AT), bookingsIndexKey(new Date(SALE))])) {
    const idx = await readJson(key, BookingsIndexDoc);
    if (idx && !idx.bookings.length) {
      await deleteKey(key);
      await fs.rm(metaOf(key), { force: true });
    }
  }
  for (const id of orders) {
    const o = await readJson(orderKey(id), Order);
    await deleteKey(orderKey(id));
    await fs.rm(metaOf(orderKey(id)), { force: true });
    if (o) {
      const key = ordersIndexKey(o.createdAt);
      const idx = await writeJsonCas(key, OrdersIndexDoc, (cur) => ({ orders: (cur?.orders ?? []).filter((x) => x.id !== id) }));
      if (!idx.orders.length) {
        await deleteKey(key);
        await fs.rm(metaOf(key), { force: true });
      }
    }
  }
  // webhook test events
  const { PaymentEventsDoc, paymentEventsKey } = await import('./schemas/logs');
  await writeJsonCas(paymentEventsKey(BOOK_AT), PaymentEventsDoc, (cur) => ({
    events: (cur?.events ?? []).filter((e) => !e.eventId.startsWith('evt_test')),
  })).catch(() => undefined);
  for (const k of [LEDGER, LEDGER2, STOCK]) {
    await deleteKey(k);
    await fs.rm(metaOf(k), { force: true });
  }
  for (const dir of ['booking-tokens', 'razorpay-bookings', 'bookings', 'bookings-index']) {
    await fs.rmdir(path.join(DATA, dir)).catch(() => undefined); // only if empty
  }
});

const ledgerUnits = async () => ((await readJson(LEDGER, PresaleLedgerDoc))?.reservations ?? []).reduce((n, r) => n + r.qty, 0);

async function payDeposit(b: { bookingId: string; razorpay: { orderId: string; amount: number } }, now = BOOK_AT) {
  return confirmBookingPayment({ razorpayOrderId: b.razorpay.orderId, razorpayPaymentId: `pay_${b.bookingId.slice(0, 8)}`, by: 'customer' }, deps(now));
}

describe('bookings (integration)', () => {
  it('server computes the deposit; token hash lookup works; raw token is never stored', async () => {
    const res = await book('one@example.com');
    expect(res.deposit).toBe(99900);
    expect(res.razorpay.amount).toBe(99900);
    const b = (await readBooking(res.bookingId))!;
    expect(b.status).toBe('deposit_pending');
    expect(b.number).toMatch(/^NWB-261020-/);
    expect(JSON.stringify(b)).not.toContain(res.token);
    expect((await bookingByToken(res.token))?.id).toBe(res.bookingId);
    expect(await bookingByToken(res.token.slice(0, -1) + (res.token.endsWith('A') ? 'B' : 'A'))).toBeNull();
    expect(await bookingByToken('../../etc/passwd')).toBeNull();
  });

  it('cap + per-customer limit via the presale ledger CAS (parallel)', async () => {
    const before = await ledgerUnits(); // 1 from the previous test
    await expect(createBooking(input('one@example.com', 2), deps(BOOK_AT))).rejects.toMatchObject({ code: 'presale_limit' });
    const results = await Promise.allSettled([book('p1@example.com'), book('p2@example.com'), book('p3@example.com')]);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    expect(ok).toBe(3 - before); // cap 3
    expect(await ledgerUnits()).toBe(3);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(BookingError);
    expect(rejected.reason.code).toBe('presale_cap');
  });

  it('unpaid deposit expires to cancelled and frees the units', async () => {
    const pending = [...created];
    const later = new Date(BOOK_AT.getTime() + 31 * 60_000);
    for (const id of pending) await advanceBooking(id, deps(later));
    for (const id of pending) expect((await readBooking(id))!.status).toBe('cancelled');
    expect(await ledgerUnits()).toBe(0);
  });

  it('late deposit payment for a cancelled booking is refunded', async () => {
    const id = [...created][0]!;
    const b = (await readBooking(id))!;
    const r = await confirmBookingPayment({ razorpayOrderId: b.depositRazorpayOrderId, razorpayPaymentId: 'pay_late', by: 'webhook' }, deps(BOOK_AT));
    expect(r.result).toBe('refunded_late');
    expect((await readBooking(id))!.status).toBe('refunded');
  });

  it('deposit → balance_due at sale start → balance checkout → normal paid order', async () => {
    sent.length = 0;
    const res = await book('flow@example.com');
    const first = await payDeposit(res);
    expect(first.result).toBe('applied');
    // verify + webhook both deliver: second is a no-op
    const again = await confirmBookingPayment({ razorpayOrderId: res.razorpay.orderId, razorpayPaymentId: 'pay_x', amount: 99900, by: 'webhook' }, deps(BOOK_AT));
    expect(again.result).toBe('duplicate');
    expect((await confirmBookingPayment({ razorpayOrderId: res.razorpay.orderId, razorpayPaymentId: 'p', amount: 1, by: 'webhook' }, deps(BOOK_AT))).result).toBe('amount_mismatch');
    expect(sent.filter((s) => s.endsWith('confirmed'))).toHaveLength(1);
    expect((await readBooking(res.bookingId))!.status).toBe('deposit_paid');

    // before sale start the balance cannot be paid
    await expect(startBalancePayment(res.token, { address, phone: '9876543210' }, deps(BOOK_AT))).rejects.toMatchObject({ status: 409 });

    const sale = new Date(SALE);
    await sweepBookings(deps(sale));
    await sweepBookings(deps(sale)); // idempotent
    const due = (await readBooking(res.bookingId))!;
    expect(due.status).toBe('balance_due');
    expect(due.balanceDueBy).toBe('2026-11-22T04:30:00.000Z');
    expect(due.finalUnitPrice).toBe(329900);
    expect(sent.filter((s) => s.startsWith('Pay the balance'))).toHaveLength(1);

    const start = await startBalancePayment(res.token, { address, phone: '9876543210' }, deps(sale));
    expect(start.balance).toMatchObject({ subtotal: 329900, deposit: 99900, shipping: 9900, balance: 239900 });
    const paid = await confirmBookingPayment({ razorpayOrderId: start.razorpay.orderId, razorpayPaymentId: 'pay_bal', amount: 239900, by: 'webhook' }, deps(sale));
    expect(paid.result).toBe('applied');
    const order = paid.result === 'applied' ? paid.order! : null;
    orders.add(order!.id);
    expect(order).toMatchObject({ status: 'paid', bookingId: res.bookingId, subtotal: 329900, discount: 99900, shipping: 9900, total: 239900, depositPaid: 99900 });
    expect(order!.preorder).toBeUndefined();
    expect(order!.stockCommittedAt).toBeTruthy();
    const inv = (await readJson(STOCK, InventoryDoc))!;
    expect(inv[order!.lines[0]!.sku]!.stock).toBe(4);
    // duplicate balance delivery: same order, no double stock
    const dup = await confirmBookingPayment({ razorpayOrderId: start.razorpay.orderId, razorpayPaymentId: 'pay_bal', by: 'customer' }, deps(sale));
    expect(dup.result).toBe('duplicate');
    expect((await readJson(STOCK, InventoryDoc))![order!.lines[0]!.sku]!.stock).toBe(4);
    const done = (await readBooking(res.bookingId))!;
    expect(done).toMatchObject({ status: 'completed', orderId: order!.id });
  });

  it('expiry outcomes: forfeit, refund (Razorpay refund API), manual, refund without keys', async () => {
    const outcomes = async (outcome: 'forfeit' | 'refund' | 'manual', d2: Partial<BookingDeps> = {}) => {
      const base = catalogue.products.find((p) => p.id === 'prod-test-booking')!;
      const cat = { ...catalogue, products: [...catalogue.products.filter((p) => p.id !== base.id), testProduct(base, { unpaidOutcome: outcome })] };
      const res = await createBooking(input(`${outcome}${d2.cfg === null ? '-nokeys' : ''}@example.com`), deps(BOOK_AT, { catalogue: cat }));
      created.add(res.bookingId);
      await payDeposit(res);
      await advanceBooking(res.bookingId, deps(new Date(SALE)));
      return advanceBooking(res.bookingId, deps(new Date('2026-11-23T00:00:00.000Z'), d2));
    };
    const before = refunds.length;
    const f = (await outcomes('forfeit'))!;
    expect(f.status).toBe('expired');
    expect(f.refund).toBeUndefined();
    const r = (await outcomes('refund'))!;
    expect(r.status).toBe('refunded');
    expect(r.refund).toMatchObject({ amount: 99900 });
    expect(refunds.length).toBe(before + 1);
    expect(refunds.at(-1)).toMatch(/\/payments\/pay_[^/]+\/refund$/);
    const m = (await outcomes('manual'))!;
    expect(m).toMatchObject({ status: 'expired', needsReview: true });
    const nk = (await outcomes('refund', { cfg: null }))!;
    expect(nk.status).toBe('expired');
    expect(nk.needsReview).toBe(true);
    expect(nk.notes).toContain('REFUND PENDING');
    expect(sent.filter((s) => s.endsWith('has expired')).length).toBeGreaterThanOrEqual(4);
  });

  it('admin: extend re-opens an expired booking; cancel + refund', async () => {
    const f = [...created].map((id) => id);
    const all = (await Promise.all(f.map((id) => readBooking(id)))).filter((b): b is Booking => !!b);
    const expired = all.find((b) => b.status === 'expired' && b.terms.unpaidOutcome === 'forfeit')!;
    const now = new Date('2026-11-23T00:00:00.000Z');
    const ext = await extendBooking(expired.id, '2026-11-30T00:00:00.000Z', 'admin@x', deps(now));
    expect(ext).toMatchObject({ status: 'balance_due', balanceDueBy: '2026-11-30T00:00:00.000Z' });
    await expect(extendBooking(expired.id, '2026-11-01T00:00:00.000Z', 'admin@x', deps(now))).rejects.toMatchObject({ status: 400 });
    const c = await cancelBooking(expired.id, { refund: true, by: 'admin@x' }, deps(now));
    expect(c.status).toBe('refunded');
    expect(c.refund?.razorpayRefundId).toMatch(/^rfnd_/);
    const tok = await issueBookingToken(expired.id, now);
    expect((await bookingByToken(tok))?.id).toBe(expired.id);
  });

  it('webhook route distinguishes booking payments by notes and is idempotent', async () => {
    // F24: pin the clock (the route reads the real clock) so this never runs past the sale date.
    vi.useFakeTimers({ toFake: ['Date'], now: BOOK_AT });
    try {
    process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec';
    const { POST } = await import('../app/api/razorpay/webhook/route');
    const res = await book('hook@example.com', 1, BOOK_AT);
    const payload = (id: string) =>
      JSON.stringify({
        event: 'payment.captured',
        payload: { payment: { entity: { id: 'pay_hook', order_id: res.razorpay.orderId, amount: 99900, notes: { kind: 'booking_deposit', bookingId: res.bookingId } } } },
        _: id,
      });
    const call = async (body: string, eventId: string) =>
      POST(
        new Request('http://x/api/razorpay/webhook', {
          method: 'POST',
          headers: { 'x-razorpay-signature': await hmacSha256Hex('whsec', body), 'x-razorpay-event-id': eventId },
          body,
        }),
      );
    const r1 = await (await call(payload('a'), `evt_test_${res.bookingId}`)).json();
    const r2 = await (await call(payload('b'), `evt_test2_${res.bookingId}`)).json();
    expect(r1.result).toBe('applied');
    expect(r2.result).toBe('duplicate');
    expect((await readBooking(res.bookingId))!.status).toBe('deposit_paid');
    const bad = await POST(new Request('http://x', { method: 'POST', headers: { 'x-razorpay-signature': 'nope' }, body: payload('c') }));
    expect(bad.status).toBe(400);
    await cancelBooking(res.bookingId, { refund: false, by: 'test' }, deps(BOOK_AT));
    } finally {
      vi.useRealTimers();
    }
  });

  it('F23: open bookings follow a moved sale date (CAS, idempotent, one email per change)', async () => {
    const d2 = (now: Date, over: Partial<BookingDeps> = {}) => deps(now, { ledgerKey: () => LEDGER2, ...over });
    const mk = async (email: string) => {
      const r = await createBooking(input(email), d2(BOOK_AT));
      created.add(r.bookingId);
      return r;
    };
    const paid = await mk('f23-paid@example.com');
    await confirmBookingPayment({ razorpayOrderId: paid.razorpay.orderId, razorpayPaymentId: 'pay_f23a', by: 'customer' }, d2(BOOK_AT));
    const pending = await mk('f23-pending@example.com');
    const due = await mk('f23-due@example.com');
    await confirmBookingPayment({ razorpayOrderId: due.razorpay.orderId, razorpayPaymentId: 'pay_f23b', by: 'customer' }, d2(BOOK_AT));
    await advanceBooking(due.bookingId, d2(new Date(SALE)));
    expect((await readBooking(due.bookingId))!.status).toBe('balance_due');

    const base = catalogue.products.find((p) => p.id === 'prod-test-booking')!;
    const NEW = '2026-12-01T04:30:00.000Z';
    const movedCat = {
      ...catalogue,
      products: [...catalogue.products.filter((p) => p.id !== base.id), testProduct(base, { saleStartsAt: NEW, balanceWindowDays: 5 })],
    };
    const now = new Date('2026-11-16T00:00:00.000Z'); // after the old sale date, before the new one
    sent.length = 0;
    const r1 = await reapplyAfterCatalogueChange(catalogue, movedCat, 'admin@x', d2(now, { catalogue: movedCat }));
    const [bp, bpen, bdue] = await Promise.all([readBooking(paid.bookingId), readBooking(pending.bookingId), readBooking(due.bookingId)]);
    expect(r1.moved).toEqual(expect.arrayContaining([bp!.number, bpen!.number, bdue!.number]));
    expect(bp).toMatchObject({ status: 'deposit_paid', terms: { saleStartsAt: NEW, balanceWindowDays: 5 } });
    expect(bpen!.terms.saleStartsAt).toBe(NEW); // then cancelled by advanceBooking: its 30-min deposit window has long passed
    // balance_due with a future sale date goes back to deposit_paid
    expect(bdue).toMatchObject({ status: 'deposit_paid', terms: { saleStartsAt: NEW } });
    expect(bdue!.balanceDueBy).toBeUndefined();
    // the paid customers are emailed once with a fresh link; the unpaid one is not
    expect(r1.emailed).toEqual(expect.arrayContaining([bp!.number, bdue!.number]));
    expect(r1.emailed).not.toContain(bpen!.number);
    expect(sent.filter((x) => x.startsWith('Your sale date has moved to 1 December 2026'))).toHaveLength(2);
    expect(bp!.tokenHashes.length).toBe(3);

    // idempotent: re-running (or a second save with the same date) changes nothing and emails nobody
    const r2 = await reapplyAfterCatalogueChange(catalogue, movedCat, 'admin@x', d2(now, { catalogue: movedCat }));
    expect(r2.moved).toEqual([]);
    expect(await reapplyAfterCatalogueChange(movedCat, movedCat, 'admin@x', d2(now))).toEqual({ checked: 0, moved: [], emailed: [] });
    expect(sent.filter((x) => x.startsWith('Your sale date has moved'))).toHaveLength(2);

    // the new sale start brings back the balance email with the new deadline
    await advanceBooking(due.bookingId, d2(new Date(NEW), { catalogue: movedCat }));
    const again = (await readBooking(due.bookingId))!;
    expect(again).toMatchObject({ status: 'balance_due', balanceDueBy: '2026-12-06T04:30:00.000Z' });
    expect(sent.filter((x) => x.startsWith('Pay the balance'))).toHaveLength(1);

    // without a Resend key: dates still move, no email claimed (a later change can still email)
    const later = { ...movedCat, products: [...catalogue.products.filter((p) => p.id !== base.id), testProduct(base, { saleStartsAt: '2026-12-10T04:30:00.000Z' })] };
    const r3 = await reapplyAfterCatalogueChange(movedCat, later, 'admin@x', d2(now, { catalogue: later, send: undefined }));
    expect(r3.moved).toContain(bp!.number);
    expect(r3.emailed).toEqual([]);
    const bp3 = (await readBooking(paid.bookingId))!;
    expect(bp3.terms.saleStartsAt).toBe('2026-12-10T04:30:00.000Z');
    expect(bp3.saleDateEmailFor).toBe(bp!.saleDateEmailFor); // still the previous change's key
    for (const id of [paid.bookingId, pending.bookingId, due.bookingId]) await cancelBooking(id, { refund: false, by: 'test' }, d2(now));
  });
});
