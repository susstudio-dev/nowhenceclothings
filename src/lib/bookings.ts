// A13 pre-booking with deposit: pure rules. Deposit / balance math, booking
// window, status transitions, token hashing and CSV. No I/O.

import type { Drop, Product, Variant } from './schemas/catalogue';
import type { LaunchDefaults } from './schemas/launches';
import type { SettingsDoc } from './schemas/settings';
import {
  canBookingTransition,
  type Booking,
  type BookingStatus,
  type BookingSummary,
} from './schemas/bookings';
import { resolveLaunch, type EffectiveDeposit, type EffectivePresale } from './launches';
import { shippingFee, unitPriceFor } from './commerce/pricing';

export class BookingError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = 'BookingError';
  }
}

// ---- ids, numbers, tokens ---------------------------------------------------

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newBookingNumber(now: Date = new Date()): string {
  const yy = String(now.getUTCFullYear()).slice(2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const rnd = crypto.getRandomValues(new Uint8Array(4));
  return `NWB-${yy}${mm}${dd}-${Array.from(rnd, (b) => ALPHABET[b % ALPHABET.length]).join('')}`;
}

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** 32 bytes from the CSPRNG, base64url (43 chars). */
export function newBookingToken(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

/** Lower-case hex SHA-256 of the token. Only this is stored. */
export async function hashBookingToken(token: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)));
  return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ---- deposit + balance math (paise) ------------------------------------------

/** Deposit for one unit; never more than the unit price. */
export function depositPerUnit(unitPrice: number, dep: Pick<EffectiveDeposit, 'depositType' | 'depositValue'>): number {
  const raw = dep.depositType === 'percent' ? Math.round((unitPrice * dep.depositValue) / 100) : dep.depositValue;
  return Math.max(0, Math.min(unitPrice, raw));
}

export function depositAmount(
  unitPrice: number,
  qty: number,
  dep: Pick<EffectiveDeposit, 'depositType' | 'depositValue'>,
): number {
  return depositPerUnit(unitPrice, dep) * qty;
}

/** Unit price at booking time: the presale price, else the live variant price. */
export function bookingUnitPrice(product: Product, variant: Variant, pre: Pick<EffectivePresale, 'price'>, now: Date): number {
  return pre.price ?? unitPriceFor(product, variant, now).unitPrice;
}

/**
 * Final unit price per the booking's price lock: 'booking' keeps the price at
 * booking; 'sale' uses the frozen sale-start price, else the live price.
 */
export function finalUnitPrice(
  b: Pick<Booking, 'lockedUnitPrice' | 'finalUnitPrice' | 'terms'>,
  live?: { product: Product; variant: Variant; now: Date },
): number {
  if (b.terms.priceLock === 'booking') return b.lockedUnitPrice;
  if (b.finalUnitPrice != null) return b.finalUnitPrice;
  return live ? unitPriceFor(live.product, live.variant, live.now).unitPrice : b.lockedUnitPrice;
}

export interface BalanceBreakdown {
  finalUnitPrice: number;
  subtotal: number;
  deposit: number;
  shipping: number;
  /** What the customer pays now. */
  balance: number;
}

export function computeBalance(
  b: Pick<Booking, 'qty' | 'deposit'>,
  unit: number,
  settings: Pick<SettingsDoc, 'shipping'>,
): BalanceBreakdown {
  const subtotal = unit * b.qty;
  const deposit = Math.min(b.deposit, subtotal);
  const shipping = shippingFee(subtotal, settings);
  return { finalUnitPrice: unit, subtotal, deposit, shipping, balance: subtotal - deposit + shipping };
}

// ---- bookability ---------------------------------------------------------------

export type BookingWindow =
  | { state: 'hidden' }
  | { state: 'not_open'; opensAt?: string; pre: EffectivePresale; dep: EffectiveDeposit }
  | { state: 'open'; pre: EffectivePresale; dep: EffectiveDeposit & { saleStartsAt: string } }
  | { state: 'closed'; pre: EffectivePresale; dep: EffectiveDeposit };

const t = (iso?: string) => (iso ? Date.parse(iso) : NaN);

/**
 * Whether /book/{slug} may take a booking now. 'hidden' = must 404 (not a
 * deposit product, not active, or still coming soon: secrecy).
 */
export function bookingWindow(product: Product, drops: Drop[], d: LaunchDefaults, now: Date = new Date()): BookingWindow {
  if (product.status !== 'active') return { state: 'hidden' };
  const r = resolveLaunch(product, drops, d, now);
  const pre = r.presale;
  if (!pre || pre.paymentMode !== 'deposit' || !pre.deposit) return { state: 'hidden' };
  if (r.state === 'coming_soon') {
    // A deposit presale that has not started yet: show only if the product is
    // itself public (availability not coming_soon) and just waiting on dates.
    if ((product.availability ?? 'available') === 'coming_soon') return { state: 'hidden' };
    return { state: 'not_open', opensAt: pre.deposit.bookingOpensAt ?? pre.startsAt, pre, dep: pre.deposit };
  }
  const dep = pre.deposit;
  const n = now.getTime();
  if (!dep.saleStartsAt) return { state: 'closed', pre, dep };
  if (t(dep.saleStartsAt) <= n) return { state: 'closed', pre, dep };
  if (dep.bookingClosesAt && t(dep.bookingClosesAt) <= n) return { state: 'closed', pre, dep };
  if (dep.bookingOpensAt && t(dep.bookingOpensAt) > n) return { state: 'not_open', opensAt: dep.bookingOpensAt, pre, dep };
  if (r.state !== 'presale') return { state: 'closed', pre, dep };
  return { state: 'open', pre, dep: { ...dep, saleStartsAt: dep.saleStartsAt } };
}

// ---- transitions ------------------------------------------------------------------

/** Transition with history; throws on an illegal transition. Pure. */
export function withBookingStatus(b: Booking, to: BookingStatus, by: string, note?: string, now = new Date()): Booking {
  if (b.status === to) return b;
  if (!canBookingTransition(b.status, to)) throw new BookingError(`Cannot move a booking from ${b.status} to ${to}.`, 409, 'transition');
  const at = now.toISOString();
  return { ...b, status: to, updatedAt: at, history: [...b.history, { at, status: to, by, ...(note ? { note } : {}) }] };
}

export function balanceDeadline(saleStartsAt: string, days: number): string {
  return new Date(Date.parse(saleStartsAt) + days * 86_400_000).toISOString();
}

export type DueTransition =
  | { to: 'cancelled'; reason: 'deposit_unpaid' }
  | { to: 'balance_due' }
  | { to: 'expired' }
  | null;

/** Which time-driven transition (if any) applies at `now`. Pure. */
export function dueTransition(
  b: Pick<Booking, 'status' | 'createdAt' | 'terms' | 'balanceDueBy'>,
  now: Date,
  paymentWindowMinutes: number,
): DueTransition {
  const n = now.getTime();
  switch (b.status) {
    case 'deposit_pending':
      return n - Date.parse(b.createdAt) > paymentWindowMinutes * 60_000 ? { to: 'cancelled', reason: 'deposit_unpaid' } : null;
    case 'deposit_paid':
      return Date.parse(b.terms.saleStartsAt) <= n ? { to: 'balance_due' } : null;
    case 'balance_due': {
      const by = b.balanceDueBy ?? balanceDeadline(b.terms.saleStartsAt, b.terms.balanceWindowDays);
      return Date.parse(by) < n ? { to: 'expired' } : null;
    }
    default:
      return null;
  }
}

/** Apply the sale-start transition: freeze the final price and the deadline. Pure. */
export function startBalanceDue(b: Booking, liveUnitPrice: number | undefined, now: Date): Booking {
  const next = withBookingStatus(b, 'balance_due', 'system', 'Sale started', now);
  return {
    ...next,
    finalUnitPrice: b.terms.priceLock === 'sale' ? (liveUnitPrice ?? b.lockedUnitPrice) : b.lockedUnitPrice,
    balanceDueBy: b.balanceDueBy ?? balanceDeadline(b.terms.saleStartsAt, b.terms.balanceWindowDays),
  };
}

export const OPEN_STATUSES: readonly BookingStatus[] = ['deposit_pending', 'deposit_paid', 'balance_due'];

/** Statuses that hold units in the presale ledger. */
export const HOLDING_STATUSES: readonly BookingStatus[] = ['deposit_pending', 'deposit_paid', 'balance_due', 'completed'];

// ---- admin helpers -------------------------------------------------------------------

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  deposit_pending: 'Awaiting deposit',
  deposit_paid: 'Deposit paid',
  balance_due: 'Balance due',
  completed: 'Completed',
  expired: 'Expired',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export interface BookingFilter {
  status?: BookingStatus | 'all';
  q?: string;
  productId?: string;
}

export function filterBookings(list: BookingSummary[], f: BookingFilter): BookingSummary[] {
  const q = f.q?.trim().toLowerCase();
  return list.filter(
    (b) =>
      (!f.status || f.status === 'all' || b.status === f.status) &&
      (!f.productId || b.productId === f.productId) &&
      (!q || [b.number, b.email, b.name, b.productTitle, b.sku].some((s) => s.toLowerCase().includes(q))),
  );
}

/** Deposits collected (paid and not refunded) and counts. */
export function bookingTotals(list: BookingSummary[]): { count: number; depositsCollected: number; byStatus: Record<string, number> } {
  const byStatus: Record<string, number> = {};
  let depositsCollected = 0;
  for (const b of list) {
    byStatus[b.status] = (byStatus[b.status] ?? 0) + 1;
    if (b.depositPaid && b.status !== 'refunded') depositsCollected += b.deposit;
  }
  return { count: list.length, depositsCollected, byStatus };
}

function csvField(value: unknown): string {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export const BOOKING_CSV_HEADER = [
  'number', 'created_at', 'status', 'name', 'email', 'product', 'sku', 'colour', 'size', 'qty',
  'deposit_inr', 'deposit_paid', 'sale_starts_at', 'balance_due_by', 'order_number', 'needs_review',
];

export function bookingsToCsv(list: BookingSummary[]): string {
  const rows = list.map((b) => [
    b.number, b.createdAt, b.status, b.name, b.email, b.productTitle, b.sku, b.colour, b.size, b.qty,
    (b.deposit / 100).toFixed(2), b.depositPaid ? 'yes' : 'no', b.saleStartsAt, b.balanceDueBy ?? '', b.orderNumber ?? '',
    b.needsReview ? 'yes' : '',
  ]);
  return [BOOKING_CSV_HEADER, ...rows].map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n';
}

/** Booking months to look in for NWB-YYMMDD-XXXX. */
export function bookingMonthForNumber(number: string): string | null {
  const m = /^NWB-(\d{2})(\d{2})\d{2}-/.exec(number);
  return m ? `20${m[1]}-${m[2]}` : null;
}
