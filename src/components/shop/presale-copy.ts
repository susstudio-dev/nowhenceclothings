// Customer-facing presale / pre-booking copy (A11, A13, A16). Pure: every
// amount is derived from the public launch view, never hard-coded.

import type { LaunchView, PublicProduct } from '@/lib/launches';
import { formatPaise } from '@/lib/money';
import { depositAmount } from './quick-buy';

export interface DepositSummary {
  /** Unit price shown (paise). */
  price: number;
  /** Deposit per unit (paise). */
  deposit: number;
  /** price - deposit (paise); with priceLock 'sale' only an estimate. */
  balance: number;
  priceLock: 'booking' | 'sale';
  saleStartsAt?: string;
  balanceWindowDays?: number;
}

/** Deposit maths for a deposit-mode presale product, else undefined. */
export function depositSummary(p: Pick<PublicProduct, 'price' | 'launch'>): DepositSummary | undefined {
  const pre = p.launch.state === 'presale' ? p.launch.presale : undefined;
  const dep = pre?.paymentMode === 'deposit' ? pre.deposit : undefined;
  if (!dep) return undefined;
  const deposit = dep.amount ?? depositAmount(dep.label, p.price);
  if (deposit == null) return undefined;
  const d = Math.max(0, Math.min(p.price, deposit));
  return {
    price: p.price,
    deposit: d,
    balance: p.price - d,
    priceLock: dep.priceLock ?? 'booking',
    ...(dep.saleStartsAt ? { saleStartsAt: dep.saleStartsAt } : {}),
    ...(dep.balanceWindowDays != null ? { balanceWindowDays: dep.balanceWindowDays } : {}),
  };
}

/** "31 Oct" in IST. */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
}

/** "31 October" in IST. */
export function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' });
}

/** Home hero: "₹500 to reserve · ₹999 when the sale opens". */
export function heroDepositLine(s: DepositSummary): string {
  const rest = s.priceLock === 'sale' ? 'the balance at the sale price when the sale opens' : `${formatPaise(s.balance)} when the sale opens`;
  return `${formatPaise(s.deposit)} to reserve · ${rest}`;
}

/** Product / booking page: "₹500 today · ₹999 balance when the sale opens on 31 Oct". */
export function depositTodayLine(s: DepositSummary): string {
  const when = s.saleStartsAt ? `when the sale opens on ${shortDate(s.saleStartsAt)}` : 'when the sale opens';
  const rest = s.priceLock === 'sale' ? `the balance at the sale price ${when}` : `${formatPaise(s.balance)} balance ${when}`;
  return `${formatPaise(s.deposit)} today · ${rest}`;
}

/** Reserve sheet "How reserving works", from the server quote. */
export function reserveHowItWorks(q: {
  deposit: number;
  unitPrice: number;
  qty: number;
  priceLock: 'booking' | 'sale';
  saleStartsAt?: string;
  balanceWindowDays: number;
}): string {
  const when = q.saleStartsAt ? `When the sale opens on ${longDate(q.saleStartsAt)}` : 'When the sale opens';
  const balance = Math.max(0, q.unitPrice * q.qty - q.deposit);
  const what = q.priceLock === 'booking' ? `the remaining ${formatPaise(balance)} (plus shipping if any)` : 'the balance at the sale price (plus shipping if any)';
  return `Pay ${formatPaise(q.deposit)} now. ${when}, we email a private link to pay ${what} within ${q.balanceWindowDays} days.`;
}

/**
 * Countdown label + target for a launch: "Sale opens" for pre-booking,
 * "Pre-orders close" for a full-payment presale end, "Releases" for a
 * coming-soon reveal.
 */
export function countdownFor(
  launch: Pick<LaunchView, 'state' | 'nextChangeAt' | 'presale'>,
): { label: string; at: string } | undefined {
  const dep = launch.presale?.paymentMode === 'deposit' ? launch.presale.deposit : undefined;
  if (launch.state === 'presale') {
    if (dep?.saleStartsAt) return { label: 'Sale opens', at: dep.saleStartsAt };
    if (!launch.nextChangeAt) return undefined;
    return { label: dep ? 'Bookings close' : 'Pre-orders close', at: launch.nextChangeAt };
  }
  if (!launch.nextChangeAt) return undefined;
  return { label: 'Releases', at: launch.nextChangeAt };
}

/**
 * One pre-order shipping line. `shipCopy` is already formatted (it usually
 * contains the date), so the date is only prefixed when the copy lacks it.
 */
export function preorderShipLine(shipBy: string | undefined, shipCopy: string | undefined, formatDate: (d: string) => string): string {
  const copy = (shipCopy ?? '').trim();
  if (!shipBy) return copy;
  const date = formatDate(shipBy);
  if (copy.includes(date) || /\bships? by\b/i.test(copy)) return copy;
  return [`Ships by ${date}.`, copy].filter(Boolean).join(' ');
}
