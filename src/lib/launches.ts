// A10 coming soon + A11 presale: pure resolution, public projection and the
// checkout rules. No I/O and no server imports, so the same code runs in
// pages, API routes, admin and tests. Dates are evaluated at request time
// (`now`), so auto-switching needs no cron.

import type { Drop, Product } from './schemas/catalogue';
import type { MediaRef } from './schemas/common';
import type {
  Availability,
  ComingSoonConfig,
  LaunchDefaults,
  PresaleAccess,
  PresaleConfig,
  PresaleLedgerDoc,
  DepositConfig,
  PresalePaymentMode,
  UnpaidOutcome,
} from './schemas/launches';

export interface EffectiveComingSoon {
  blur: boolean;
  blurStrength: number;
  showTitle: boolean;
  showPrice: boolean;
  teaser: string;
  badge: string;
  hiddenTitle: string;
  notify: boolean;
  showInShop: boolean;
  showOnHome: boolean;
  showOnComingSoonPage: boolean;
  revealAt?: string;
  revealTo: 'presale' | 'available';
}

export interface EffectivePresale {
  source: 'product' | 'drop' | 'default';
  startsAt?: string;
  endsAt?: string;
  price?: number;
  cap?: number;
  perCustomerLimit: number;
  shipBy?: string;
  shipCopy: string;
  access: PresaleAccess;
  accessCode?: string;
  terms: string;
  ctaLabel: string;
  badge: string;
  autoSwitchAtEnd: boolean;
  /** A13. Absent = 'full'. */
  paymentMode?: PresalePaymentMode;
  /** A13: resolved deposit terms when paymentMode is 'deposit'. */
  deposit?: EffectiveDeposit;
}

/** A13 resolved deposit settings (product/drop value, else Settings -> Launches). */
export interface EffectiveDeposit {
  depositType: 'fixed' | 'percent';
  depositValue: number;
  bookingOpensAt?: string;
  bookingClosesAt?: string;
  saleStartsAt?: string;
  balanceWindowDays: number;
  priceLock: 'booking' | 'sale';
  depositRefundable: boolean;
  policyMarkdown: string;
  unpaidOutcome: UnpaidOutcome;
  bookCtaLabel: string;
}

export function effectiveDeposit(
  cfg: DepositConfig | undefined,
  presale: { startsAt?: string; endsAt?: string },
  d: LaunchDefaults,
): EffectiveDeposit {
  const c = cfg ?? {};
  const g = d.presale.deposit;
  return {
    depositType: c.depositType ?? g.depositType,
    depositValue: c.depositValue ?? g.depositValue,
    bookingOpensAt: c.bookingOpensAt ?? presale.startsAt,
    bookingClosesAt: c.bookingClosesAt ?? presale.endsAt,
    saleStartsAt: c.saleStartsAt,
    balanceWindowDays: c.balanceWindowDays ?? g.balanceWindowDays,
    priceLock: c.priceLock ?? g.priceLock,
    depositRefundable: c.depositRefundable ?? g.depositRefundable,
    policyMarkdown: c.policyMarkdown?.trim() || g.policyMarkdown,
    unpaidOutcome: c.unpaidOutcome ?? g.unpaidOutcome,
    bookCtaLabel: g.bookCtaLabel,
  };
}

export interface ResolvedLaunch {
  state: Availability;
  comingSoon: EffectiveComingSoon;
  /** Set whenever a presale config applies (open, upcoming or ended). */
  presale: EffectivePresale | null;
  /** When the current state will change on its own, if known. */
  nextChangeAt?: string;
}

const ms = (iso: string | undefined) => (iso ? new Date(iso).getTime() : NaN);
const pick = <T>(v: T | undefined, d: T): T => (v === undefined ? d : v);

export function effectiveComingSoon(cfg: ComingSoonConfig | undefined, d: LaunchDefaults): EffectiveComingSoon {
  const c = cfg ?? ({ revealTo: 'available', blurred: [] } as ComingSoonConfig);
  const g = d.comingSoon;
  return {
    blur: pick(c.blur, g.blur),
    blurStrength: pick(c.blurStrength, g.blurStrength),
    showTitle: pick(c.showTitle, g.showTitle),
    showPrice: pick(c.showPrice, g.showPrice),
    teaser: c.teaser?.trim() || g.teaser,
    badge: c.badge?.trim() || g.badge,
    hiddenTitle: c.hiddenTitle?.trim() || g.hiddenTitle,
    notify: pick(c.notify, g.notify),
    showInShop: pick(c.showInShop, g.showInShop),
    showOnHome: pick(c.showOnHome, g.showOnHome),
    showOnComingSoonPage: pick(c.showOnComingSoonPage, g.showOnComingSoonPage),
    revealAt: c.revealAt,
    revealTo: c.revealTo ?? 'available',
  };
}

export function effectivePresale(
  cfg: PresaleConfig | undefined,
  source: EffectivePresale['source'],
  d: LaunchDefaults,
): EffectivePresale {
  const c = cfg ?? ({ enabled: true } as PresaleConfig);
  const g = d.presale;
  return {
    source,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    price: c.price,
    cap: c.cap,
    perCustomerLimit: c.perCustomerLimit ?? g.perCustomerLimit,
    shipBy: c.shipBy,
    shipCopy: c.shipCopy?.trim() || g.shipCopy,
    access: c.access ?? g.access,
    accessCode: c.accessCode?.trim() || undefined,
    terms: c.terms?.trim() || g.terms,
    ctaLabel: c.ctaLabel?.trim() || g.ctaLabel,
    badge: c.badge?.trim() || g.badge,
    autoSwitchAtEnd: pick(c.autoSwitchAtEnd, g.autoSwitchAtEnd),
    ...(c.paymentMode === 'deposit'
      ? { paymentMode: 'deposit' as const, deposit: effectiveDeposit(c.deposit, c, d) }
      : {}),
  };
}

/** The presale config that applies to a product: its own, else its drop's. */
export function presaleFor(product: Product, drops: Drop[], d: LaunchDefaults): EffectivePresale | null {
  if (product.presale?.enabled) return effectivePresale(product.presale, 'product', d);
  const drop = product.dropId ? drops.find((x) => x.id === product.dropId) : undefined;
  if (drop?.presale?.enabled) return effectivePresale(drop.presale, 'drop', d);
  return null;
}

/**
 * Resolve the live availability of a product at `now`.
 * - coming_soon flips to `revealTo` once `revealAt` passes;
 * - presale before `startsAt` shows as coming_soon, after `endsAt` becomes
 *   available (autoSwitchAtEnd) or sold_out;
 * - an `available` product whose presale (own or drop) window is open is in presale.
 */
export function resolveLaunch(product: Product, drops: Drop[], d: LaunchDefaults, now: Date = new Date()): ResolvedLaunch {
  const t = now.getTime();
  const comingSoon = effectiveComingSoon(product.comingSoon, d);
  const cfg = presaleFor(product, drops, d);
  let state: Availability = product.availability ?? 'available';
  let nextChangeAt: string | undefined;

  if (state === 'coming_soon') {
    if (comingSoon.revealAt && ms(comingSoon.revealAt) <= t) state = comingSoon.revealTo;
    else nextChangeAt = comingSoon.revealAt;
  }

  let presale: EffectivePresale | null = cfg;
  if (state === 'presale' && !presale) presale = effectivePresale(undefined, 'default', d);
  if (state === 'available' && cfg && (cfg.startsAt || cfg.endsAt)) {
    const started = !cfg.startsAt || ms(cfg.startsAt) <= t;
    const ended = !!cfg.endsAt && ms(cfg.endsAt) <= t;
    if (started && !ended) state = 'presale';
  }
  if (state === 'presale' && presale) {
    if (presale.startsAt && ms(presale.startsAt) > t) {
      state = 'coming_soon';
      nextChangeAt = presale.startsAt;
    } else if (presale.endsAt && ms(presale.endsAt) <= t) {
      state = presale.autoSwitchAtEnd ? 'available' : 'sold_out';
    } else if (presale.endsAt) {
      nextChangeAt = presale.endsAt;
    }
  }
  return { state, comingSoon, presale, nextChangeAt };
}

// ---- public projection (secrecy) ------------------------------------------

/** What the storefront may know about a launch. Never contains secrets. */
export interface LaunchView {
  state: Availability;
  badge?: string;
  teaser?: string;
  titleHidden: boolean;
  priceHidden: boolean;
  blurred: boolean;
  notify: boolean;
  /** Countdown target (reveal / presale start / presale end). */
  nextChangeAt?: string;
  presale?: {
    shipBy?: string;
    shipCopy: string;
    access: PresaleAccess;
    terms: string;
    ctaLabel: string;
    endsAt?: string;
    perCustomerLimit: number;
    /** A13: 'deposit' = book via /book/{slug} instead of the cart. */
    paymentMode?: 'deposit';
    deposit?: {
      label: string;
      saleStartsAt?: string;
      ctaLabel: string;
      /** Deposit per unit in paise at the shown price (display only; /api/bookings recomputes). */
      amount?: number;
      priceLock?: 'booking' | 'sale';
      balanceWindowDays?: number;
    };
  };
}

export type PublicProduct = Product & { launch: LaunchView };

/** Blurred counterparts of `images`, in order; images without one are dropped. */
export function blurredImages(images: MediaRef[], cfg: ComingSoonConfig | undefined, alt: string): MediaRef[] {
  const map = new Map((cfg?.blurred ?? []).map((b) => [b.sourceId, b.media]));
  const out: MediaRef[] = [];
  for (const img of images) {
    const b = map.get(img.id);
    if (b) out.push({ ...b, alt });
  }
  return out;
}

/** Coming-soon image set: never contains the sharp originals when blurred. */
export function teaserImages(product: Product, cs: EffectiveComingSoon, alt: string): Product['colours'] {
  return product.colours.map((c) => ({
    ...c,
    images: cs.blur ? blurredImages(c.images, product.comingSoon, alt) : c.images,
  }));
}

/**
 * Storefront-safe copy of a product. While coming soon, hidden fields are
 * replaced (not just hidden in CSS) so nothing leaks into HTML, RSC payloads,
 * metadata, JSON-LD or the search index. Raw launch configs (access codes,
 * sharp/blurred mapping) are always removed.
 */
export function toPublicProduct(product: Product, drops: Drop[], d: LaunchDefaults, now: Date = new Date()): PublicProduct {
  const r = resolveLaunch(product, drops, d, now);
  const { comingSoon: _cs, presale: _ps, availability: _av, ...rest } = product;
  const base: Product = { ...rest };
  const pre = r.presale;

  if (r.state === 'coming_soon') {
    const cs = r.comingSoon;
    const title = cs.showTitle ? product.title : cs.hiddenTitle;
    const priceHidden = !cs.showPrice;
    const out: Product = {
      ...base,
      title,
      description: cs.teaser,
      fabric: '',
      care: '',
      fit: '',
      relatedIds: [],
      seo: cs.showTitle ? { title: product.seo.title } : {},
      colours: teaserImages(product, cs, `${cs.badge}: ${title}`),
      price: priceHidden ? 0 : product.price,
      compareAtPrice: priceHidden ? undefined : product.compareAtPrice,
      saleEndsAt: priceHidden ? undefined : product.saleEndsAt,
      variants: priceHidden
        ? product.variants.map((v) => ({ sku: v.sku, colourId: v.colourId, size: v.size }))
        : product.variants,
    };
    if (out.compareAtPrice === undefined) delete out.compareAtPrice;
    if (out.saleEndsAt === undefined) delete out.saleEndsAt;
    return {
      ...out,
      launch: {
        state: 'coming_soon',
        badge: cs.badge,
        teaser: cs.teaser,
        titleHidden: !cs.showTitle,
        priceHidden,
        blurred: cs.blur,
        notify: cs.notify,
        nextChangeAt: r.nextChangeAt,
      },
    };
  }

  if (r.state === 'presale' && pre) {
    const priced = applyPresalePrice(base, pre);
    return {
      ...priced,
      launch: {
        state: 'presale',
        badge: pre.badge,
        titleHidden: false,
        priceHidden: false,
        blurred: false,
        notify: r.comingSoon.notify,
        nextChangeAt: r.nextChangeAt,
        presale: {
          shipBy: pre.shipBy,
          shipCopy: formatShipCopy(pre.shipCopy, pre.shipBy, { deposit: pre.paymentMode === 'deposit' }),
          access: pre.access,
          terms: presaleTerms(pre.terms, pre.shipBy),
          ctaLabel: pre.ctaLabel,
          endsAt: pre.endsAt,
          perCustomerLimit: pre.perCustomerLimit,
          ...(pre.paymentMode === 'deposit' && pre.deposit
            ? {
                paymentMode: 'deposit' as const,
                deposit: {
                  label: depositLabel(pre.deposit),
                  ...(pre.deposit.saleStartsAt ? { saleStartsAt: pre.deposit.saleStartsAt } : {}),
                  ctaLabel: pre.deposit.bookCtaLabel,
                  amount: unitDeposit(priced.price, pre.deposit),
                  priceLock: pre.deposit.priceLock,
                  balanceWindowDays: pre.deposit.balanceWindowDays,
                },
              }
            : {}),
        },
      },
    };
  }

  return {
    ...base,
    launch: {
      state: r.state,
      badge: r.state === 'sold_out' ? 'Sold out' : undefined,
      titleHidden: false,
      priceHidden: false,
      blurred: false,
      notify: r.state === 'sold_out',
    },
  };
}

/** Presale price replaces the normal price (variant overrides ignored); the
 *  normal price becomes the strike-through when higher. */
export function applyPresalePrice<P extends Product>(product: P, pre: Pick<EffectivePresale, 'price'>): P {
  if (pre.price == null) return product;
  const out: P = {
    ...product,
    price: pre.price,
    variants: product.variants.map((v) => ({ sku: v.sku, colourId: v.colourId, size: v.size })),
  };
  delete out.saleEndsAt;
  if (product.price > pre.price) out.compareAtPrice = product.price;
  else delete out.compareAtPrice;
  return out;
}

/** "₹999 deposit" / "20% deposit". */
export function depositLabel(dep: Pick<EffectiveDeposit, 'depositType' | 'depositValue'>): string {
  if (dep.depositType === 'percent') return `${dep.depositValue}% deposit`;
  const r = dep.depositValue / 100;
  return `₹${r.toLocaleString('en-IN', { maximumFractionDigits: 2 })} deposit`;
}

/** Same rule as bookings.depositPerUnit (kept here to avoid a circular import). */
function unitDeposit(price: number, dep: Pick<EffectiveDeposit, 'depositType' | 'depositValue'>): number {
  const raw = dep.depositType === 'percent' ? Math.round((price * dep.depositValue) / 100) : dep.depositValue;
  return Math.max(0, Math.min(price, raw));
}

const SENTENCE = /[^.!?]+[.!?]*/g;
const DATE_REF = /\{date\}|the date shown/i;

/**
 * Fill `{date}` with the ship-by date. Without a ship-by date, sentences that
 * point at a date ("Ships by {date}.") are dropped rather than promising "the
 * date shown" when none is shown; deposit pieces then say when they ship.
 */
export function formatShipCopy(copy: string, shipBy: string | undefined, opts: { deposit?: boolean } = {}): string {
  if (shipBy) {
    const date = new Date(`${shipBy}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    return copy.replace(/\{date\}/g, date);
  }
  const kept = (copy.match(SENTENCE) ?? [])
    .map((x) => x.trim())
    .filter((x) => x && !DATE_REF.test(x))
    .join(' ');
  return opts.deposit ? [kept, 'Ships after the sale opens.'].filter(Boolean).join(' ') : kept;
}

/** Presale terms without a dangling "ship by the date shown" when no date is set. */
export function presaleTerms(terms: string, shipBy: string | undefined): string {
  if (shipBy) return terms;
  return terms.replace(/\s+and ship by the date shown/gi, '').replace(/\s*Ships? by the date shown\.?/gi, '').trim();
}

export type Surface = 'shop' | 'home' | 'comingSoonPage';

/** Whether a projected product belongs on a storefront surface. */
export function listedOn(p: PublicProduct, surface: Surface, product?: Product, d?: LaunchDefaults): boolean {
  const cs = product && d ? effectiveComingSoon(product.comingSoon, d) : null;
  const isSoon = p.launch.state === 'coming_soon';
  switch (surface) {
    case 'shop':
      return !isSoon || (cs?.showInShop ?? true);
    case 'home':
      return isSoon && (cs?.showOnHome ?? true);
    case 'comingSoonPage':
      return isSoon && (cs?.showOnComingSoonPage ?? true);
  }
}

/** Sitemap / Product JSON-LD: coming-soon pieces are never indexed. */
export function isIndexable(p: { launch?: LaunchView }): boolean {
  return p.launch?.state !== 'coming_soon';
}

// ---- checkout rules --------------------------------------------------------

export class PresaleRuleError extends Error {
  constructor(
    message: string,
    readonly code: 'presale_cap' | 'presale_limit' | 'presale_access' | 'mixed_cart',
  ) {
    super(message);
    this.name = 'PresaleRuleError';
  }
}

export const MIXED_CART_MESSAGE =
  'Pre-order pieces ship later, so they need their own checkout. Remove either the pre-order or the in-stock pieces from your bag.';

/** No mixing presale with in-stock lines. */
export function assertNotMixed(flags: boolean[]): void {
  if (flags.some(Boolean) && flags.some((f) => !f)) throw new PresaleRuleError(MIXED_CART_MESSAGE, 'mixed_cart');
}

/**
 * Pure CAS mutator: add a reservation if the total cap and the per-email
 * limit allow it. Idempotent per orderId.
 */
export function reservePresale(
  ledger: PresaleLedgerDoc,
  req: { orderId: string; email: string; qty: number; cap?: number; perCustomerLimit: number; at: string },
): PresaleLedgerDoc {
  const email = req.email.trim().toLowerCase();
  if (ledger.reservations.some((r) => r.orderId === req.orderId)) return ledger;
  const total = ledger.reservations.reduce((n, r) => n + r.qty, 0);
  if (req.cap != null && total + req.qty > req.cap) {
    const left = Math.max(0, req.cap - total);
    throw new PresaleRuleError(
      left ? `Only ${left} pre-order ${left === 1 ? 'unit is' : 'units are'} left.` : 'Pre-orders for this piece are full.',
      'presale_cap',
    );
  }
  const mine = ledger.reservations.filter((r) => r.email === email).reduce((n, r) => n + r.qty, 0);
  if (mine + req.qty > req.perCustomerLimit) {
    throw new PresaleRuleError(`Pre-orders are limited to ${req.perCustomerLimit} per customer.`, 'presale_limit');
  }
  return { reservations: [...ledger.reservations, { orderId: req.orderId, email, qty: req.qty, at: req.at }] };
}

export function releasePresale(ledger: PresaleLedgerDoc, orderId: string): PresaleLedgerDoc {
  return { reservations: ledger.reservations.filter((r) => r.orderId !== orderId) };
}

export function presaleUnits(ledger: PresaleLedgerDoc | null): number {
  return (ledger?.reservations ?? []).reduce((n, r) => n + r.qty, 0);
}

/** Constant-time-ish comparison of access codes (case-insensitive). */
export function codeMatches(expected: string | undefined, given: string | undefined): boolean {
  if (!expected) return false;
  const a = expected.trim().toUpperCase();
  const b = (given ?? '').trim().toUpperCase();
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** A11 access gate. `waitlist` = emails on the product notify list. */
export function assertPresaleAccess(
  pre: Pick<EffectivePresale, 'access' | 'accessCode'>,
  input: { code?: string; email?: string; waitlist: string[] },
): void {
  if (pre.access === 'public') return;
  if (pre.access === 'code') {
    if (!codeMatches(pre.accessCode, input.code)) throw new PresaleRuleError('That pre-order access code is not valid.', 'presale_access');
    return;
  }
  const email = (input.email ?? '').trim().toLowerCase();
  if (!email || !input.waitlist.includes(email)) {
    throw new PresaleRuleError('This pre-order is open to the waitlist only. Use the email you signed up with.', 'presale_access');
  }
}
