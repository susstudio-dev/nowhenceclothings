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

/** "10:00 am IST" */
function clock(iso: string): string {
  return `${new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST`;
}

/** "31 October at 10:00 am IST" */
export function saleMoment(iso: string): string {
  return `${longDate(iso)} at ${clock(iso)}`;
}

/** Product / booking page: "Reserve today for ₹500 · Pay ₹999 when the sale opens on 31 Oct, 10:00 am IST". */
export function depositTodayLine(s: DepositSummary): string {
  const when = s.saleStartsAt ? `when the sale opens on ${shortDate(s.saleStartsAt)}, ${clock(s.saleStartsAt)}` : 'when the sale opens';
  const rest = s.priceLock === 'sale' ? `Pay the balance at the sale price ${when}` : `Pay ${formatPaise(s.balance)} ${when}`;
  return `Reserve today for ${formatPaise(s.deposit)} · ${rest}`;
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

export interface PreorderFaqContext {
  /** Size exchanges after delivery, e.g. { days: 7 }; absent when exchanges are off. */
  exchange?: { days: number };
}

/** Courier transit after dispatch; the same wording as the Shipping page. */
export const DELIVERY_AFTER_DISPATCH = 'Delivery then takes 2–6 working days, depending on your PIN code.';

/** The piece's short name for sentences: "The Panther Polo" -> "the Panther". */
export function pieceName(title: string): string {
  return title.replace(/\s+polo$/i, '').replace(/^the\s+/i, 'the ');
}

/** When a pre-order ships, as one sentence: the ship-by date, else the owner's ship copy, else after the sale. */
export function preorderShipSentence(p: Pick<PublicProduct, 'launch'>): string {
  const pre = p.launch.state === 'presale' ? p.launch.presale : undefined;
  if (!pre) return '';
  if (pre.shipBy) {
    const d = new Date(`${pre.shipBy}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', timeZone: 'UTC' });
    return `Ships by ${d}.`;
  }
  const said = (pre.shipCopy.match(/[^.!?]+[.!?]*/g) ?? []).map((x) => x.trim()).find((x) => /\bships?\b/i.test(x));
  return said ?? (pre.paymentMode === 'deposit' ? 'Ships after the sale opens.' : 'Ships when the pre-order closes.');
}

/**
 * The trust line under the Reserve / Pre-order button: run size, refund terms, shipping, exchange, limit.
 * "Limited first run of 100. Reservations are non-refundable. Orders ship within 2–3 weeks of the sale opening.
 *  One free size exchange. Limit 2 per customer."
 */
export function preorderTrustLine(p: Pick<PublicProduct, 'launch'>, ctx: PreorderFaqContext = {}): string {
  const pre = p.launch.state === 'presale' ? p.launch.presale : undefined;
  if (!pre) return '';
  const dep = pre.paymentMode === 'deposit' ? pre.deposit : undefined;
  const ship = preorderShipSentence(p);
  // The owner's ship copy leads (it carries the run size); its shipping sentence moves after the refund terms.
  const lead = (pre.shipCopy.match(/[^.!?]+[.!?]*/g) ?? []).map((x) => x.trim()).filter((x) => x && x !== ship);
  return [
    ...lead,
    dep ? (dep.refundable ? 'Reservations are refundable until you pay the balance.' : 'Reservations are non-refundable.') : '',
    ship,
    ctx.exchange ? 'One free size exchange.' : '',
    `Limit ${pre.perCustomerLimit} per customer.`,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Pre-order questions (A13 trust), shown on the product page and the FAQ: the booking terms, said before the
 * customer reserves rather than only at checkout. Every answer is read from the launch config.
 */
export function preorderFaq(
  p: Pick<PublicProduct, 'price' | 'launch'> & { title?: string },
  ctx: PreorderFaqContext = {},
): { q: string; a: string }[] {
  const pre = p.launch.state === 'presale' ? p.launch.presale : undefined;
  if (!pre) return [];
  const dep = pre.paymentMode === 'deposit' ? pre.deposit : undefined;
  const s = depositSummary(p);
  const ship = preorderShipSentence(p);
  const out: { q: string; a: string }[] = [];

  if (dep && s) {
    const when = s.saleStartsAt ? `When the sale opens on ${saleMoment(s.saleStartsAt)}` : 'When the sale opens';
    const balance = s.priceLock === 'sale' ? 'the balance at the sale price' : `the ${formatPaise(s.balance)} balance`;
    const days = dep.balanceWindowDays;
    out.push({
      q: 'How does the pre-order work?',
      a: `Pay ${formatPaise(s.deposit)} today to reserve your piece and size. ${when}, we'll send you a link to pay ${balance}${days ? ` within ${days} days` : ''}. ${ship}`,
    });
    const swap = ctx.exchange ? " If the size isn't right when it arrives, we'll exchange it once for free." : '';
    out.push({
      q: 'Can I cancel a reservation?',
      a: dep.refundable
        ? `Yes. Write to us before you pay the balance and we'll refund your ${formatPaise(s.deposit)}.`
        : `This is a limited run${pre.cap ? ` of ${pre.cap}` : ''}, so reservations are non-refundable.${swap}`,
    });
  }

  out.push({ q: 'When does it ship?', a: `${ship} ${DELIVERY_AFTER_DISPATCH}` });
  out.push({
    q: 'Can I change my size?',
    a: [
      dep ? "Yes. Write to us before you pay the balance and we'll switch it while that size lasts." : "Yes. Write to us before it ships and we'll switch it while that size lasts.",
      ctx.exchange ? `After delivery, you get one free size exchange within ${ctx.exchange.days} days, if the piece is unworn and still has its tags.` : '',
    ]
      .filter(Boolean)
      .join(' '),
  });
  return out;
}

/**
 * Home strip under the hero: "The first run: 100 pieces." then
 * "The Panther opens on 31 October at 10:00 am IST. Reserve yours for ₹500 today. Pay the ₹999 balance when the sale opens."
 */
export function presaleNoteCopy(product: Pick<PublicProduct, 'title' | 'price' | 'launch'>): { heading?: string; body: string } | null {
  const pre = product.launch.state === 'presale' ? product.launch.presale : undefined;
  if (!pre) return null;
  const dep = depositSummary(product);
  const name = /^the\s/i.test(product.title) ? pieceName(product.title).replace(/^the/, 'The') : 'The sale';
  const heading = pre.cap ? `The first run: ${pre.cap} pieces.` : undefined;
  if (dep?.saleStartsAt) {
    const balance = dep.priceLock === 'sale' ? 'the balance' : `the ${formatPaise(dep.balance)} balance`;
    return { heading, body: `${name} opens on ${saleMoment(dep.saleStartsAt)}. Reserve yours for ${formatPaise(dep.deposit)} today. Pay ${balance} when the sale opens.` };
  }
  if (pre.shipCopy) return { heading, body: pre.shipCopy };
  return heading ? { heading, body: '' } : null;
}
