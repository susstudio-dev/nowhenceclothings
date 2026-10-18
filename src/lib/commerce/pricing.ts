// Pure pricing engine (C1, C3, C4, C5). Every amount is integer paise and
// GST-inclusive. No I/O: callers pass in the catalogue rows, the coupon and
// the settings, so the same function runs on the server (authoritative) and
// in tests. The client never computes a total that the server trusts.

import type { Coupon } from '@/lib/schemas/coupons';
import type { Product, Variant } from '@/lib/schemas/catalogue';
import type { SettingsDoc } from '@/lib/schemas/settings';

export interface UnitPrice {
  /** What the customer pays per unit. */
  unitPrice: number;
  /** Strike-through price, only while a sale is active. */
  compareAtPrice?: number;
  onSale: boolean;
}

/**
 * C3. Base price is `variant.priceOverride ?? product.price`, and the
 * comparison price is `variant.compareAtPriceOverride ?? product.compareAtPrice`.
 * A sale is active while compareAt > base and `saleEndsAt` is unset or in the
 * future. Once the sale has ended the item reverts to the compare-at price.
 */
export function unitPriceFor(product: Product, variant: Variant, now: Date = new Date()): UnitPrice {
  const base = variant.priceOverride ?? product.price;
  const compareAt = variant.compareAtPriceOverride ?? product.compareAtPrice;
  if (compareAt == null || compareAt <= base) return { unitPrice: base, onSale: false };
  const ended = product.saleEndsAt != null && new Date(product.saleEndsAt).getTime() <= now.getTime();
  if (ended) return { unitPrice: compareAt, onSale: false };
  return { unitPrice: base, compareAtPrice: compareAt, onSale: true };
}

export type CouponRejection =
  | 'not_found'
  | 'inactive'
  | 'not_started'
  | 'expired'
  | 'usage_limit'
  | 'min_order';

export const COUPON_MESSAGES: Record<CouponRejection, string> = {
  not_found: 'That code does not exist.',
  inactive: 'That code is no longer active.',
  not_started: 'That code is not active yet.',
  expired: 'That code has expired.',
  usage_limit: 'That code has been fully redeemed.',
  min_order: 'Your order does not meet the minimum for this code.',
};

/** C4. Checks a coupon against the merchandise subtotal. Pure. */
export function checkCoupon(
  coupon: Coupon | undefined,
  subtotal: number,
  now: Date = new Date(),
): { ok: true } | { ok: false; reason: CouponRejection } {
  if (!coupon) return { ok: false, reason: 'not_found' };
  if (!coupon.active) return { ok: false, reason: 'inactive' };
  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now.getTime()) return { ok: false, reason: 'not_started' };
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() <= now.getTime()) return { ok: false, reason: 'expired' };
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) return { ok: false, reason: 'usage_limit' };
  if (subtotal < coupon.minOrder) return { ok: false, reason: 'min_order' };
  return { ok: true };
}

/** Discount in paise for a valid coupon; never more than the subtotal. */
export function couponDiscount(coupon: Coupon, subtotal: number): number {
  switch (coupon.type) {
    case 'percent': {
      const raw = Math.floor((subtotal * coupon.value) / 100);
      const capped = coupon.maxDiscount != null ? Math.min(raw, coupon.maxDiscount) : raw;
      return Math.min(capped, subtotal);
    }
    case 'flat':
      return Math.min(coupon.value, subtotal);
    case 'free_shipping':
      return 0;
  }
}

/** Flat fee unless the merchandise subtotal reaches the free threshold. A threshold of 0 means no free tier. */
export function shippingFee(subtotal: number, settings: Pick<SettingsDoc, 'shipping'>): number {
  if (subtotal <= 0) return 0;
  const { freeShippingThreshold: t, flatFee } = settings.shipping;
  return t > 0 && subtotal >= t ? 0 : flatFee;
}

export interface PricingInputLine {
  product: Product;
  variant: Variant;
  qty: number;
}

export interface PricedLine extends UnitPrice {
  sku: string;
  qty: number;
  lineTotal: number;
}

export interface PriceBreakdown {
  lines: PricedLine[];
  /** Sum of line totals after sale pricing, before coupon. */
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  /** Normalised code when a coupon was applied. */
  couponCode?: string;
  /** Set when a code was supplied but rejected; the totals ignore it. */
  couponError?: CouponRejection;
  freeShippingThreshold: number;
  /** Paise still needed for free shipping (0 when reached). */
  freeShippingRemaining: number;
}

/**
 * C5. Computes the full breakdown. `coupon` is the looked-up coupon (or
 * undefined if the code did not match), `couponCode` the raw code typed.
 */
export function priceCart(input: {
  lines: PricingInputLine[];
  settings: Pick<SettingsDoc, 'shipping'>;
  couponCode?: string;
  coupon?: Coupon;
  now?: Date;
}): PriceBreakdown {
  const now = input.now ?? new Date();
  const lines: PricedLine[] = input.lines.map(({ product, variant, qty }) => {
    if (!Number.isSafeInteger(qty) || qty < 1) throw new Error(`invalid qty for ${variant.sku}`);
    const p = unitPriceFor(product, variant, now);
    return { sku: variant.sku, qty, ...p, lineTotal: p.unitPrice * qty };
  });
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  let discount = 0;
  let shipping = shippingFee(subtotal, input.settings);
  let couponCode: string | undefined;
  let couponError: CouponRejection | undefined;

  const typed = input.couponCode?.trim();
  if (typed) {
    const check = checkCoupon(input.coupon, subtotal, now);
    if (check.ok && input.coupon) {
      couponCode = input.coupon.code;
      discount = couponDiscount(input.coupon, subtotal);
      if (input.coupon.type === 'free_shipping') shipping = 0;
    } else if (!check.ok) {
      couponError = check.reason;
    }
  }

  const threshold = input.settings.shipping.freeShippingThreshold;
  return {
    lines,
    subtotal,
    discount,
    shipping,
    total: subtotal - discount + shipping,
    couponCode,
    couponError,
    freeShippingThreshold: threshold,
    freeShippingRemaining: Math.max(0, threshold - subtotal),
  };
}

/** Case-insensitive lookup that matches CouponCode's normalisation. */
export function findCoupon(coupons: Coupon[], code: string | undefined): Coupon | undefined {
  if (!code) return undefined;
  const norm = code.trim().toUpperCase();
  return coupons.find((c) => c.code === norm);
}
