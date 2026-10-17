// A13 pre-booking with deposit: R2 I/O. Create booking (deposit), confirm
// deposit/balance payments (client verify + webhook, idempotent), sale-start
// and expiry transitions (request time + cron), balance checkout and the
// conversion into a normal paid Order, admin actions.

import 'server-only';
import { getCatalogue } from './catalogue';
import { getSettings } from './content';
import { createJson, deleteKey, listKeys, readJson, writeJsonCas } from './storage';
import {
  Booking,
  BookingsIndexDoc,
  BookingTokenDoc,
  RazorpayBookingDoc,
  bookingKey,
  bookingsIndexKey,
  bookingTokenKey,
  BOOKINGS_INDEX_PREFIX,
  razorpayBookingKey,
  summarizeBooking,
  type BalanceAttempt,
  type BookingEmailKind,
  type BookingSummary,
} from './schemas/bookings';
import { newOrderNumber, Order, orderKey, type Order as OrderT } from './schemas/order';
import { presaleLedgerKey } from './schemas/launches';
import type { CatalogueDoc } from './schemas/catalogue';
import type { SettingsDoc } from './schemas/settings';
import type { Address } from './schemas/common';
import {
  BookingError,
  OPEN_STATUSES,
  TOKEN_RE,
  bookingUnitPrice,
  bookingWindow,
  computeBalance,
  depositAmount,
  dueTransition,
  finalUnitPrice,
  hashBookingToken,
  newBookingNumber,
  newBookingToken,
  productsWithMovedSaleTerms,
  reapplySaleTerms,
  saleTermsKey,
  startBalanceDue,
  type SaleTerms,
  withBookingStatus,
  type BalanceBreakdown,
} from './bookings';
import { renderBookingEmail } from './bookings-email';
import { PresaleRuleError, assertPresaleAccess } from './launches';
import { releasePresaleUnits, reservePresaleUnits, waitlistEmails } from './launches-server';
import { createRazorpayOrder, razorpayConfig, refundPayment, type RazorpayConfig } from './commerce/razorpay';
import { sendEmail } from './commerce/email';
import { sendOrderEmailOnce, syncOrderIndex } from './commerce/orders';
import { commitStock, OversellError } from './commerce/stock';
import { unitPriceFor } from './commerce/pricing';
import { INVENTORY_KEY } from './schemas/inventory';
import { ensureBookingCreditNote, ensureBookingReceipt, ensureOrderInvoice, quietly } from './invoices/store';

export { BookingError } from './bookings';

/** Test seams. Defaults hit the real store / env. */
export interface BookingDeps {
  cfg?: RazorpayConfig | null;
  fetchImpl?: typeof fetch;
  now?: Date;
  ledgerKey?: (productId: string) => string;
  stockKey?: string;
  catalogue?: CatalogueDoc;
  settings?: SettingsDoc;
  waitlist?: (productId: string) => Promise<string[]>;
  /** Called instead of sendEmail (tests). */
  send?: typeof sendEmail;
}

const cfgOf = (d: BookingDeps) => (d.cfg === undefined ? razorpayConfig() : d.cfg);
const ledgerOf = (d: BookingDeps) => d.ledgerKey ?? presaleLedgerKey;
const catOf = async (d: BookingDeps) => d.catalogue ?? (await getCatalogue());
const settingsOf = async (d: BookingDeps) => d.settings ?? (await getSettings());

// ---- storage primitives ---------------------------------------------------------

export function readBooking(id: string): Promise<Booking | null> {
  if (!/^[A-Za-z0-9-]{1,64}$/.test(id)) return Promise.resolve(null);
  return readJson(bookingKey(id), Booking);
}

export async function syncBookingIndex(b: Booking): Promise<void> {
  try {
    await writeJsonCas(
      bookingsIndexKey(b.createdAt),
      BookingsIndexDoc,
      (cur) => {
        const bookings = (cur?.bookings ?? []).filter((x) => x.id !== b.id);
        bookings.push(summarizeBooking(b));
        bookings.sort((x, y) => y.createdAt.localeCompare(x.createdAt));
        return { bookings };
      },
      { initial: () => ({ bookings: [] }) },
    );
  } catch (err) {
    console.error('bookings-index: sync failed', b.number, err instanceof Error ? err.message : '');
  }
}

/** CAS-update a booking; `mutate` returns null for "no change". */
export async function updateBooking(id: string, mutate: (b: Booking) => Booking | null): Promise<{ booking: Booking; changed: boolean }> {
  let changed = false;
  const booking = await writeJsonCas(bookingKey(id), Booking, (cur) => {
    if (!cur) throw new BookingError('Booking not found.', 404, 'not_found');
    const next = mutate(cur);
    changed = next !== null;
    return next ?? cur;
  });
  if (changed) await syncBookingIndex(booking);
  return { booking, changed };
}

export async function listBookingSummaries(): Promise<BookingSummary[]> {
  const keys = (await listKeys(BOOKINGS_INDEX_PREFIX)).map((k) => k.key).filter((k) => /bookings-index\/\d{4}-\d{2}\.json$/.test(k));
  const docs = await Promise.all(keys.map((k) => readJson(k, BookingsIndexDoc)));
  return docs.flatMap((d) => d?.bookings ?? []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ---- tokens ------------------------------------------------------------------------

/** Mint a new balance-link token for a booking (adds its hash). Returns the raw token. */
export async function issueBookingToken(id: string, now: Date = new Date()): Promise<string> {
  const token = newBookingToken();
  const hash = await hashBookingToken(token);
  await createJson(bookingTokenKey(hash), BookingTokenDoc, { bookingId: id, createdAt: now.toISOString() });
  await updateBooking(id, (b) => ({ ...b, tokenHashes: [...b.tokenHashes, hash].slice(-20) }));
  return token;
}

/** Look a booking up by its raw token. Constant work for unknown tokens. */
export async function bookingByToken(token: string): Promise<Booking | null> {
  if (!TOKEN_RE.test(token)) return null;
  const hash = await hashBookingToken(token);
  const map = await readJson(bookingTokenKey(hash), BookingTokenDoc);
  if (!map) return null;
  const b = await readBooking(map.bookingId);
  return b && b.tokenHashes.includes(hash) ? b : null;
}

// ---- emails ------------------------------------------------------------------------

/**
 * Send a booking email. With `once`, at most once per kind (emailsSent).
 * Mints a fresh link token for kinds that carry the link. Never throws.
 */
export async function sendBookingEmail(id: string, kind: BookingEmailKind, deps: BookingDeps = {}, once = true): Promise<boolean> {
  try {
    const b = await readBooking(id);
    if (!b || (once && b.emailsSent.includes(kind))) return false;
    const settings = await settingsOf(deps);
    const withLink = kind === 'deposit_paid' || kind === 'balance_due' || kind === 'sale_date_moved';
    const token = withLink ? await issueBookingToken(id, deps.now) : null;
    const fresh = (await readBooking(id)) ?? b;
    let balance: number | undefined;
    if (kind === 'balance_due') balance = computeBalance(fresh, finalUnitPrice(fresh), settings).balance;
    const res = await (deps.send ?? sendEmail)(renderBookingEmail(fresh, kind, token, settings, balance));
    if (!res.sent) {
      if (res.reason === 'error') console.error('booking email failed', kind, b.number, res.detail);
      return false;
    }
    await updateBooking(id, (x) => (x.emailsSent.includes(kind) ? null : { ...x, emailsSent: [...x.emailsSent, kind] }));
    return true;
  } catch (err) {
    console.error('sendBookingEmail', kind, err instanceof Error ? err.message : '');
    return false;
  }
}

// ---- create (deposit checkout) ----------------------------------------------------------

export interface CreateBookingInput {
  slug: string;
  sku: string;
  qty: number;
  name: string;
  email: string;
  phone: string;
  code?: string;
  acceptPolicy: true;
  /** A15: optional address now (prefills the balance checkout and the receipt). */
  address?: Address;
  billingAddress?: Address;
  gstin?: string;
}

export interface CreateBookingResult {
  bookingId: string;
  number: string;
  token: string;
  deposit: number;
  razorpay: {
    key: string;
    orderId: string;
    amount: number;
    currency: 'INR';
    name: string;
    prefill: { name: string; email: string; contact: string };
  };
}

export async function createBooking(input: CreateBookingInput, deps: BookingDeps = {}): Promise<CreateBookingResult> {
  const cfg = cfgOf(deps);
  if (!cfg) throw new BookingError('Payments are not configured.', 503, 'payments_unconfigured');
  const now = deps.now ?? new Date();
  const [cat, settings] = await Promise.all([catOf(deps), settingsOf(deps)]);
  const product = cat.products.find((p) => p.slug === input.slug);
  if (!product) throw new BookingError('Not found.', 404, 'not_found');
  const win = bookingWindow(product, cat.drops, settings.launches, now);
  if (win.state === 'hidden') throw new BookingError('Not found.', 404, 'not_found');
  if (win.state !== 'open') throw new BookingError('Bookings for this piece are not open.', 409, 'booking_closed');
  const variant = product.variants.find((v) => v.sku === input.sku);
  if (!variant) throw new BookingError('Choose a colour and size.', 400, 'variant');
  const { pre, dep } = win;
  const email = input.email.trim().toLowerCase();
  try {
    assertPresaleAccess(pre, {
      code: input.code,
      email,
      waitlist: pre.access === 'waitlist' ? await (deps.waitlist ? deps.waitlist(product.id) : waitlistEmails(product)) : [],
    });
  } catch (err) {
    if (err instanceof PresaleRuleError) throw new BookingError(err.message, 403, err.code);
    throw err;
  }

  const unit = bookingUnitPrice(product, variant, pre, now);
  const deposit = depositAmount(unit, input.qty, dep);
  if (deposit < 100) throw new BookingError('This piece cannot be booked right now.', 409, 'deposit_invalid');

  const id = crypto.randomUUID();
  const number = newBookingNumber(now);
  const ledger = ledgerOf(deps)(product.id);
  try {
    await reservePresaleUnits(
      product.id,
      { orderId: id, email, qty: input.qty, cap: pre.cap, perCustomerLimit: pre.perCustomerLimit, at: now.toISOString() },
      ledger,
    );
  } catch (err) {
    if (err instanceof PresaleRuleError) throw new BookingError(err.message.replace(/Pre-order/g, 'Booking'), 409, err.code);
    throw err;
  }

  try {
    const rzp = await createRazorpayOrder(
      cfg,
      { amount: deposit, receipt: number, notes: { kind: 'booking_deposit', bookingId: id, number } },
      deps.fetchImpl,
    );
    if (rzp.amount !== deposit) throw new BookingError('Price changed, please retry.', 409, 'price_changed');
    const token = newBookingToken();
    const hash = await hashBookingToken(token);
    const at = now.toISOString();
    const colour = product.colours.find((c) => c.id === variant.colourId);
    const booking: Booking = {
      id,
      number,
      status: 'deposit_pending',
      email,
      name: input.name.trim(),
      phone: input.phone,
      ...(input.address ? { address: input.address } : {}),
      ...(input.billingAddress ? { billingAddress: input.billingAddress } : {}),
      ...(input.gstin ? { buyerGstin: input.gstin } : {}),
      productId: product.id,
      productSlug: product.slug,
      productTitle: product.title,
      sku: variant.sku,
      colour: colour?.name ?? variant.colourId,
      size: variant.size,
      qty: input.qty,
      lockedUnitPrice: unit,
      deposit,
      terms: {
        priceLock: dep.priceLock,
        depositRefundable: dep.depositRefundable,
        unpaidOutcome: dep.unpaidOutcome,
        saleStartsAt: dep.saleStartsAt,
        balanceWindowDays: dep.balanceWindowDays,
        policy: dep.policyMarkdown,
      },
      tokenHashes: [hash],
      depositRazorpayOrderId: rzp.id,
      balanceAttempts: [],
      emailsSent: [],
      history: [{ at, status: 'deposit_pending', by: 'customer' }],
      notes: '',
      createdAt: at,
      updatedAt: at,
    };
    if (!(await createJson(bookingKey(id), Booking, booking))) throw new Error('booking id collision');
    await createJson(bookingTokenKey(hash), BookingTokenDoc, { bookingId: id, createdAt: at });
    await createJson(razorpayBookingKey(rzp.id), RazorpayBookingDoc, { bookingId: id, kind: 'deposit', createdAt: at });
    await syncBookingIndex(booking);
    return {
      bookingId: id,
      number,
      token,
      deposit,
      razorpay: {
        key: cfg.keyId,
        orderId: rzp.id,
        amount: deposit,
        currency: 'INR',
        name: settings.store.name,
        prefill: { name: booking.name, email, contact: input.phone },
      },
    };
  } catch (err) {
    await releasePresaleUnits(product.id, id, ledger).catch(() => undefined);
    throw err;
  }
}

// ---- payment confirmation (verify + webhook) ----------------------------------------------

export async function bookingRefForRazorpayOrder(rzpOrderId: string): Promise<RazorpayBookingDoc | null> {
  if (!/^[A-Za-z0-9_]{1,64}$/.test(rzpOrderId)) return null;
  return readJson(razorpayBookingKey(rzpOrderId), RazorpayBookingDoc);
}

/** Notes set on our Razorpay orders: tells booking payments from order payments. */
export function isBookingPaymentNotes(notes: unknown): boolean {
  const k = (notes as { kind?: unknown } | null | undefined)?.kind;
  return k === 'booking_deposit' || k === 'booking_balance';
}

export type BookingConfirmResult =
  | { result: 'applied' | 'duplicate' | 'refunded_late' | 'amount_mismatch' | 'ignored'; booking: Booking; order?: OrderT }
  | { result: 'not_found' };

export async function confirmBookingPayment(
  p: { razorpayOrderId: string; razorpayPaymentId: string; amount?: number; by: 'customer' | 'webhook' },
  deps: BookingDeps = {},
): Promise<BookingConfirmResult> {
  const ref = await bookingRefForRazorpayOrder(p.razorpayOrderId);
  if (!ref) return { result: 'not_found' };
  return ref.kind === 'deposit' ? confirmDeposit(ref.bookingId, p, deps) : confirmBalance(ref.bookingId, p, deps);
}

async function confirmDeposit(
  id: string,
  p: { razorpayOrderId: string; razorpayPaymentId: string; amount?: number; by: string },
  deps: BookingDeps,
): Promise<BookingConfirmResult> {
  const existing = await readBooking(id);
  if (!existing) return { result: 'not_found' };
  if (p.amount != null && p.amount !== existing.deposit) return { result: 'amount_mismatch', booking: existing };
  const now = deps.now ?? new Date();
  let won = false;
  const { booking } = await updateBooking(id, (b) => {
    won = false;
    if (b.status !== 'deposit_pending' || b.depositRazorpayOrderId !== p.razorpayOrderId) return null;
    won = true;
    return { ...withBookingStatus(b, 'deposit_paid', p.by, undefined, now), depositPaymentId: p.razorpayPaymentId };
  });
  if (!won) {
    if (booking.status === 'cancelled' && !booking.depositPaymentId && !booking.refund) {
      // Paid after the unpaid booking was cancelled: give it back.
      const b2 = await refundDeposit(id, p.razorpayPaymentId, 'Deposit received after the booking was cancelled', 'system', deps);
      return { result: 'refunded_late', booking: b2 };
    }
    return { result: booking.status === 'deposit_pending' ? 'ignored' : 'duplicate', booking };
  }
  await quietly('booking receipt', () => ensureBookingReceipt(id, { settings: deps.settings }));
  await sendBookingEmail(id, 'deposit_paid', deps);
  const advanced = await advanceBooking(id, deps);
  return { result: 'applied', booking: advanced ?? booking };
}

async function confirmBalance(
  id: string,
  p: { razorpayOrderId: string; razorpayPaymentId: string; amount?: number; by: string },
  deps: BookingDeps,
): Promise<BookingConfirmResult> {
  const existing = await readBooking(id);
  if (!existing) return { result: 'not_found' };
  const attempt = existing.balanceAttempts.find((a) => a.razorpayOrderId === p.razorpayOrderId);
  if (!attempt) return { result: 'not_found' };
  if (p.amount != null && p.amount !== attempt.amount) return { result: 'amount_mismatch', booking: existing };
  const now = deps.now ?? new Date();
  const orderId = crypto.randomUUID();
  const orderNumber = newOrderNumber(now);
  let won = false;
  const { booking } = await updateBooking(id, (b) => {
    won = false;
    // Late payment after expiry is still honoured unless the deposit was refunded.
    if (b.status !== 'balance_due' && b.status !== 'expired') return null;
    won = true;
    const reopened = b.status === 'expired' ? withBookingStatus(b, 'balance_due', p.by, 'Balance paid after deadline', now) : b;
    return {
      ...withBookingStatus(reopened, 'completed', p.by, `Order ${orderNumber}`, now),
      balancePaymentId: p.razorpayPaymentId,
      balanceRazorpayOrderId: p.razorpayOrderId,
      finalUnitPrice: attempt.finalUnitPrice,
      orderId,
      orderNumber,
    };
  });
  if (!won) {
    if (booking.status === 'completed' && booking.orderId) {
      const order = await ensureOrderForBooking(booking, deps);
      return { result: 'duplicate', booking, order: order ?? undefined };
    }
    console.error('balance paid for a booking that cannot complete — refund manually', booking.number, booking.status);
    await updateBooking(id, (b) => ({
      ...b,
      needsReview: true,
      notes: `${b.notes}${b.notes ? '\n' : ''}Balance payment ${p.razorpayPaymentId} received while ${b.status}; refund manually.`,
    }));
    return { result: 'ignored', booking };
  }
  const order = await ensureOrderForBooking(booking, deps);
  return { result: 'applied', booking, order: order ?? undefined };
}

/** Pure: the paid Order for a completed booking. */
export function buildOrderFromBooking(b: Booking, attempt: BalanceAttempt, paymentId: string, now: Date): OrderT {
  const at = now.toISOString();
  const discount = Math.min(b.deposit, attempt.subtotal);
  return {
    id: b.orderId!,
    number: b.orderNumber!,
    email: b.email,
    phone: attempt.phone,
    shippingAddress: attempt.address,
    ...(b.billingAddress ? { billingAddress: b.billingAddress } : {}),
    ...(b.buyerGstin ? { buyerGstin: b.buyerGstin } : {}),
    lines: [
      {
        sku: b.sku,
        productId: b.productId,
        title: b.productTitle,
        colour: b.colour,
        size: b.size,
        qty: b.qty,
        unitPrice: attempt.finalUnitPrice,
      },
    ],
    subtotal: attempt.subtotal,
    discount,
    shipping: attempt.shipping,
    total: attempt.subtotal - discount + attempt.shipping,
    status: 'paid',
    razorpayOrderId: attempt.razorpayOrderId,
    razorpayPaymentId: paymentId,
    emailsSent: [],
    history: [{ at, status: 'paid', by: 'system', note: `Balance paid for booking ${b.number}` }],
    notes: `Converted from booking ${b.number}. Deposit paid: ₹${(b.deposit / 100).toFixed(2)}.`,
    bookingId: b.id,
    depositPaid: discount,
    createdAt: at,
    updatedAt: at,
  };
}

/**
 * Create (once) the paid order for a completed booking and commit stock via
 * the normal inventory path. Oversell leaves the order paid without
 * stockCommittedAt (admin "Commit stock" retry), never auto-refunds a booking.
 */
export async function ensureOrderForBooking(b: Booking, deps: BookingDeps = {}): Promise<OrderT | null> {
  if (b.status !== 'completed' || !b.orderId || !b.balancePaymentId) return null;
  const existing = await readJson(orderKey(b.orderId), Order);
  if (existing?.stockCommittedAt) return existing;
  const attempt = b.balanceAttempts.find((a) => a.razorpayOrderId === b.balanceRazorpayOrderId);
  if (!attempt) return null;
  const now = deps.now ?? new Date();
  let order = existing;
  if (!order) {
    const built = buildOrderFromBooking(b, attempt, b.balancePaymentId, now);
    await createJson(orderKey(built.id), Order, built);
    order = (await readJson(orderKey(built.id), Order)) ?? built;
    await syncOrderIndex(order);
  }
  // Claim the stock commit on the order doc (CAS) so it happens once.
  const claimAt = now.toISOString();
  let claimed = false;
  const cur = await writeJsonCas(orderKey(order.id), Order, (o) => {
    if (!o) throw new Error('order missing');
    claimed = !o.stockCommittedAt;
    return claimed ? { ...o, stockCommittedAt: claimAt } : o;
  });
  if (claimed) {
    try {
      await commitStock([{ sku: b.sku, qty: b.qty }], deps.stockKey ?? INVENTORY_KEY);
    } catch (err) {
      await writeJsonCas(orderKey(order.id), Order, (o) => {
        if (!o || o.stockCommittedAt !== claimAt) return o!;
        const rest = { ...o };
        delete rest.stockCommittedAt;
        if (err instanceof OversellError) rest.notes = `${o.notes}\nSTOCK NOT DEDUCTED: inventory short at conversion; use Commit stock.`;
        return rest;
      });
      if (!(err instanceof OversellError)) throw err;
    }
    await quietly('order invoice', () => ensureOrderInvoice(order!.id, { settings: deps.settings }));
    await sendOrderEmailOnce(order.id, 'confirmation');
  }
  return (await readJson(orderKey(order.id), Order)) ?? cur;
}

// ---- balance checkout (/pay/{token}) -------------------------------------------------------

export interface BalanceQuote extends BalanceBreakdown {
  dueBy?: string;
}

export async function quoteBalance(b: Booking, deps: BookingDeps = {}): Promise<BalanceQuote> {
  const [cat, settings] = await Promise.all([catOf(deps), settingsOf(deps)]);
  const product = cat.products.find((p) => p.id === b.productId);
  const variant = product?.variants.find((v) => v.sku === b.sku);
  const unit = finalUnitPrice(b, product && variant ? { product, variant, now: deps.now ?? new Date() } : undefined);
  return { ...computeBalance(b, unit, settings), dueBy: b.balanceDueBy };
}

export async function startBalancePayment(
  token: string,
  input: { address: Address; phone: string },
  deps: BookingDeps = {},
): Promise<{ number: string; balance: BalanceQuote; razorpay: CreateBookingResult['razorpay'] }> {
  const cfg = cfgOf(deps);
  if (!cfg) throw new BookingError('Payments are not configured.', 503, 'payments_unconfigured');
  const found = await bookingByToken(token);
  if (!found) throw new BookingError('Not found.', 404, 'not_found');
  const b = (await advanceBooking(found.id, deps)) ?? found;
  if (b.status !== 'balance_due') throw new BookingError('This booking has no balance to pay right now.', 409, b.status);
  const q = await quoteBalance(b, deps);
  if (q.balance < 100) throw new BookingError('Nothing to pay. Contact us to complete the order.', 409, 'no_balance');
  const settings = await settingsOf(deps);
  const rzp = await createRazorpayOrder(
    cfg,
    { amount: q.balance, receipt: b.number, notes: { kind: 'booking_balance', bookingId: b.id, number: b.number } },
    deps.fetchImpl,
  );
  if (rzp.amount !== q.balance) throw new BookingError('Price changed, please retry.', 409, 'price_changed');
  const at = (deps.now ?? new Date()).toISOString();
  const attempt: BalanceAttempt = {
    razorpayOrderId: rzp.id,
    amount: q.balance,
    finalUnitPrice: q.finalUnitPrice,
    subtotal: q.subtotal,
    shipping: q.shipping,
    address: input.address,
    phone: input.phone,
    createdAt: at,
  };
  await updateBooking(b.id, (x) => (x.status === 'balance_due' ? { ...x, balanceAttempts: [...x.balanceAttempts, attempt].slice(-10) } : null));
  await createJson(razorpayBookingKey(rzp.id), RazorpayBookingDoc, { bookingId: b.id, kind: 'balance', createdAt: at });
  return {
    number: b.number,
    balance: q,
    razorpay: {
      key: cfg.keyId,
      orderId: rzp.id,
      amount: q.balance,
      currency: 'INR',
      name: settings.store.name,
      prefill: { name: input.address.name, email: b.email, contact: input.phone },
    },
  };
}

// ---- time-driven transitions -----------------------------------------------------------------

async function releaseUnitsQuietly(b: Booking, deps: BookingDeps): Promise<void> {
  try {
    await releasePresaleUnits(b.productId, b.id, ledgerOf(deps)(b.productId));
  } catch (err) {
    console.error('booking release failed', b.number, err instanceof Error ? err.message : '');
  }
}

/**
 * Apply any due transition to one booking (idempotent, CAS):
 * deposit_pending past the payment window → cancelled; deposit_paid at sale
 * start → balance_due (+ email); balance_due past the deadline → expired
 * (+ unpaid outcome). Never throws; returns the current booking.
 */
export async function advanceBooking(id: string, deps: BookingDeps = {}): Promise<Booking | null> {
  try {
    const now = deps.now ?? new Date();
    let b = await readBooking(id);
    if (!b) return null;
    const settings = await settingsOf(deps);
    for (let i = 0; i < 3; i++) {
      const due = dueTransition(b, now, settings.orders.paymentWindowMinutes);
      if (!due) return b;
      if (due.to === 'cancelled') {
        const { booking, changed } = await updateBooking(id, (x) =>
          dueTransition(x, now, settings.orders.paymentWindowMinutes)?.to === 'cancelled'
            ? withBookingStatus(x, 'cancelled', 'system', 'Deposit not paid in time', now)
            : null,
        );
        if (changed) await releaseUnitsQuietly(booking, deps);
        return booking;
      }
      if (due.to === 'balance_due') {
        const cat = await catOf(deps);
        const pid = b.productId;
        const sku = b.sku;
        const product = cat.products.find((p) => p.id === pid);
        const variant = product?.variants.find((v) => v.sku === sku);
        const live = product && variant ? unitPriceFor(product, variant, now).unitPrice : undefined;
        const { booking, changed } = await updateBooking(id, (x) =>
          dueTransition(x, now, settings.orders.paymentWindowMinutes)?.to === 'balance_due' ? startBalanceDue(x, live, now) : null,
        );
        if (changed) await sendBookingEmail(id, 'balance_due', deps);
        b = (await readBooking(id)) ?? booking;
        continue;
      }
      // expired
      const { booking, changed } = await updateBooking(id, (x) =>
        dueTransition(x, now, settings.orders.paymentWindowMinutes)?.to === 'expired'
          ? {
              ...withBookingStatus(x, 'expired', 'system', `Balance not paid; outcome ${x.terms.unpaidOutcome}`, now),
              ...(x.terms.unpaidOutcome === 'manual' ? { needsReview: true } : {}),
            }
          : null,
      );
      if (!changed) return booking;
      await releaseUnitsQuietly(booking, deps);
      await sendBookingEmail(id, 'expired', deps);
      if (booking.terms.unpaidOutcome === 'refund' && booking.depositPaymentId) {
        return await refundDeposit(id, booking.depositPaymentId, 'Balance not paid; deposit refunded per booking terms', 'system', deps);
      }
      return (await readBooking(id)) ?? booking;
    }
    return b;
  } catch (err) {
    console.error('advanceBooking', id, err instanceof Error ? err.message : '');
    return readBooking(id).catch(() => null);
  }
}

/** Cron + admin sweep over every open booking. Never throws. */
export async function sweepBookings(deps: BookingDeps = {}): Promise<{ checked: number; changed: number }> {
  let checked = 0;
  let changed = 0;
  try {
    const open = (await listBookingSummaries()).filter((s) => OPEN_STATUSES.includes(s.status));
    for (const s of open) {
      checked++;
      const b = await advanceBooking(s.id, deps);
      if (b && b.status !== s.status) changed++;
    }
  } catch (err) {
    console.error('sweepBookings', err instanceof Error ? err.message : '');
  }
  return { checked, changed };
}

// ---- refunds + admin actions ---------------------------------------------------------------------

/**
 * Refund the deposit through Razorpay (POST /v1/payments/{id}/refund). Without
 * keys or on API failure, the booking is flagged needsReview with a note.
 */
export async function refundDeposit(id: string, paymentId: string, reason: string, by: string, deps: BookingDeps = {}): Promise<Booking> {
  const b = await readBooking(id);
  if (!b) throw new BookingError('Booking not found.', 404, 'not_found');
  if (b.refund) return b;
  const cfg = cfgOf(deps);
  let refundId: string | undefined;
  if (cfg) {
    try {
      refundId = (await refundPayment(cfg, paymentId, b.deposit, { booking: b.number }, deps.fetchImpl)).id;
    } catch (err) {
      console.error('deposit refund failed — refund manually', b.number, err instanceof Error ? err.message : '');
    }
  }
  const now = deps.now ?? new Date();
  const { booking } = await updateBooking(id, (x) => {
    if (x.refund) return null;
    if (!refundId) {
      return {
        ...x,
        depositPaymentId: x.depositPaymentId ?? paymentId,
        needsReview: true,
        notes: `${x.notes}${x.notes ? '\n' : ''}REFUND PENDING: ${reason}. Razorpay refund not issued; refund manually.`,
        updatedAt: now.toISOString(),
      };
    }
    const base = x.status === 'refunded' ? x : withBookingStatus(x, 'refunded', by, reason, now);
    return {
      ...base,
      depositPaymentId: x.depositPaymentId ?? paymentId,
      refund: { amount: x.deposit, razorpayRefundId: refundId, at: now.toISOString(), reason },
      needsReview: false,
    };
  });
  if (refundId) {
    await releaseUnitsQuietly(booking, deps); // no-op if already released
    if (booking.receipt) await quietly('booking credit note', () => ensureBookingCreditNote(id, { settings: deps.settings }));
    await sendBookingEmail(id, 'refunded', deps);
  }
  return booking;
}

export async function cancelBooking(id: string, opts: { refund: boolean; by: string; reason?: string }, deps: BookingDeps = {}): Promise<Booking> {
  const now = deps.now ?? new Date();
  const reason = opts.reason?.trim() || 'Cancelled by the store';
  const { booking, changed } = await updateBooking(id, (b) => {
    if (b.status === 'cancelled' || b.status === 'refunded' || b.status === 'completed') return null;
    return withBookingStatus(b, 'cancelled', opts.by, reason, now);
  });
  if (changed) await releaseUnitsQuietly(booking, deps);
  if (opts.refund && booking.depositPaymentId && !booking.refund && (booking.status === 'cancelled' || booking.status === 'expired')) {
    return refundDeposit(id, booking.depositPaymentId, reason, opts.by, deps);
  }
  if (changed) await sendBookingEmail(id, 'cancelled', deps);
  return booking;
}

/** Move the balance deadline; re-opens an expired (not refunded) booking. */
export async function extendBooking(id: string, until: string, by: string, deps: BookingDeps = {}): Promise<Booking> {
  const now = deps.now ?? new Date();
  if (!(Date.parse(until) > now.getTime())) throw new BookingError('The new deadline must be in the future.', 400, 'deadline');
  const cur = await readBooking(id);
  if (!cur) throw new BookingError('Booking not found.', 404, 'not_found');
  if (cur.status !== 'balance_due' && cur.status !== 'expired' && cur.status !== 'deposit_paid') {
    throw new BookingError(`A ${cur.status} booking cannot be extended.`, 409, 'status');
  }
  if (cur.status === 'expired') {
    // Units were released at expiry: take them back (cap still applies).
    const cat = await catOf(deps);
    const settings = await settingsOf(deps);
    const product = cat.products.find((p) => p.id === cur.productId);
    const pre = product ? bookingWindow(product, cat.drops, settings.launches, now) : null;
    const cap = pre && pre.state !== 'hidden' ? pre.pre.cap : undefined;
    try {
      await reservePresaleUnits(
        cur.productId,
        { orderId: cur.id, email: cur.email, qty: cur.qty, cap, perCustomerLimit: Number.MAX_SAFE_INTEGER, at: now.toISOString() },
        ledgerOf(deps)(cur.productId),
      );
    } catch (err) {
      if (err instanceof PresaleRuleError) throw new BookingError(err.message, 409, err.code);
      throw err;
    }
  }
  const { booking } = await updateBooking(id, (b) => {
    const base = b.status === 'expired' ? withBookingStatus(b, 'balance_due', by, 'Deadline extended', now) : b;
    const at = now.toISOString();
    return {
      ...base,
      balanceDueBy: until,
      updatedAt: at,
      history: b.status === 'expired' ? base.history : [...base.history, { at, status: base.status, by, note: `Deadline extended to ${until}` }],
    };
  });
  return booking;
}

/** Admin resend: mints a fresh link and emails it (not deduplicated). */
export async function resendBookingLink(id: string, deps: BookingDeps = {}): Promise<boolean> {
  const b = await readBooking(id);
  if (!b) throw new BookingError('Booking not found.', 404, 'not_found');
  if (b.status !== 'deposit_paid' && b.status !== 'balance_due') {
    throw new BookingError('Links can be resent for paid deposits and due balances only.', 409, 'status');
  }
  return sendBookingEmail(id, b.status === 'balance_due' ? 'balance_due' : 'deposit_paid', deps, false);
}

/** Removes every key a booking created (tests / admin hard delete). */
export async function purgeBookingKeys(b: Booking): Promise<void> {
  const keys = [
    bookingKey(b.id),
    razorpayBookingKey(b.depositRazorpayOrderId),
    ...b.balanceAttempts.map((a) => razorpayBookingKey(a.razorpayOrderId)),
    ...b.tokenHashes.map(bookingTokenKey),
  ];
  for (const k of keys) await deleteKey(k).catch(() => undefined);
  await writeJsonCas(bookingsIndexKey(b.createdAt), BookingsIndexDoc, (cur) => ({
    bookings: (cur?.bookings ?? []).filter((x) => x.id !== b.id),
  }), { initial: () => ({ bookings: [] }) }).catch(() => undefined);
}

// ---- F23: open bookings follow a moved sale date ---------------------------------------------

/** Statuses whose sale date follows the product (owner decision, F23). */
const FOLLOW_STATUSES = OPEN_STATUSES;

/** Open bookings (deposit_pending / deposit_paid / balance_due) for these products. */
export async function openBookingsFor(productIds: string[]): Promise<BookingSummary[]> {
  if (!productIds.length) return [];
  const ids = new Set(productIds);
  return (await listBookingSummaries()).filter((s) => ids.has(s.productId) && FOLLOW_STATUSES.includes(s.status));
}

/** Open bookings whose dates would move if the product/drop changed to these terms (admin preview). */
export async function bookingsToMove(productIds: string[], terms: SaleTerms): Promise<BookingSummary[]> {
  const key = saleTermsKey(terms);
  const open = await openBookingsFor(productIds);
  const out: BookingSummary[] = [];
  for (const s of open) {
    const b = await readBooking(s.id);
    if (b && saleTermsKey(b.terms) !== key) out.push(s);
  }
  return out;
}

export interface ReapplyResult {
  checked: number;
  moved: string[];
  emailed: string[];
}

/**
 * Re-apply the current sale terms to every open booking of the given products
 * (CAS per booking, idempotent). Customers with a paid deposit get one
 * "sale date moved" email per change. Then applies any now-due transition.
 */
export async function reapplySaleDates(
  changes: Array<{ productId: string; terms: SaleTerms }>,
  by: string,
  deps: BookingDeps = {},
): Promise<ReapplyResult> {
  const now = deps.now ?? new Date();
  const result: ReapplyResult = { checked: 0, moved: [], emailed: [] };
  for (const { productId, terms } of changes) {
    for (const s of await openBookingsFor([productId])) {
      result.checked++;
      try {
        const { booking, changed } = await updateBooking(s.id, (b) => reapplySaleTerms(b, terms, now, by));
        if (!changed) continue;
        result.moved.push(booking.number);
        if (await notifySaleDateMoved(booking.id, deps)) result.emailed.push(booking.number);
        await advanceBooking(booking.id, deps);
      } catch (err) {
        console.error('reapplySaleDates', s.number, err instanceof Error ? err.message : '');
      }
    }
  }
  return result;
}

/** Email the customer once per sale-terms change (claimed on the booking via CAS). Never throws. */
export async function notifySaleDateMoved(id: string, deps: BookingDeps = {}): Promise<boolean> {
  let key = '';
  let prev: string | undefined;
  try {
    const { changed } = await updateBooking(id, (b) => {
      if (b.status !== 'deposit_paid' && b.status !== 'balance_due') return null;
      key = saleTermsKey(b.terms);
      prev = b.saleDateEmailFor;
      return b.saleDateEmailFor === key ? null : { ...b, saleDateEmailFor: key };
    });
    if (!changed) return false;
    const sent = await sendBookingEmail(id, 'sale_date_moved', deps, false);
    if (!sent) {
      // Not sent (no Resend key or provider error): release the claim.
      await updateBooking(id, (b) => {
        if (b.saleDateEmailFor !== key) return null;
        const next = { ...b };
        if (prev) next.saleDateEmailFor = prev;
        else delete next.saleDateEmailFor;
        return next;
      });
    }
    return sent;
  } catch (err) {
    console.error('notifySaleDateMoved', id, err instanceof Error ? err.message : '');
    return false;
  }
}

/**
 * Call around a catalogue write: re-applies moved sale terms to open bookings.
 * `before`/`after` are the catalogue before and after the save.
 */
export async function reapplyAfterCatalogueChange(
  before: CatalogueDoc,
  after: CatalogueDoc,
  by: string,
  deps: BookingDeps = {},
): Promise<ReapplyResult> {
  const settings = await settingsOf(deps);
  const changes = productsWithMovedSaleTerms(before, after, settings.launches);
  if (!changes.length) return { checked: 0, moved: [], emailed: [] };
  return reapplySaleDates(changes, by, { ...deps, catalogue: deps.catalogue ?? after, settings });
}
