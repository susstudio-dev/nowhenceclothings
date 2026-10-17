import { z } from 'zod';
import { Id, IsoDate, Paise } from './common';

export const COUPONS_KEY = 'coupons.json';

export const CouponCode = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(z.string().regex(/^[A-Z0-9_-]{3,32}$/, '3-32 chars A-Z 0-9 _ -'));

const Base = z.object({
  id: Id,
  /** Stored upper-case; lookups normalise input to upper-case. */
  code: CouponCode,
  description: z.string().default(''),
  active: z.boolean().default(true),
  /** Minimum merchandise subtotal (after sale pricing), paise. */
  minOrder: Paise.default(0),
  startsAt: IsoDate.optional(),
  expiresAt: IsoDate.optional(),
  /** Total redemptions allowed; undefined = unlimited. */
  usageLimit: z.number().int().positive().optional(),
  /** Incremented (CAS) when an order using it is paid. */
  usedCount: z.number().int().nonnegative().default(0),
  createdAt: IsoDate,
});

export const Coupon = z.discriminatedUnion('type', [
  Base.extend({
    type: z.literal('percent'),
    /** Whole percent, 1-100. */
    value: z.number().int().min(1).max(100),
    /** Optional cap on the discount, paise. */
    maxDiscount: Paise.optional(),
  }),
  Base.extend({ type: z.literal('flat'), value: Paise }),
  Base.extend({ type: z.literal('free_shipping') }),
]);
export type Coupon = z.infer<typeof Coupon>;
export type CouponType = Coupon['type'];

export const CouponsDoc = z.object({ coupons: z.array(Coupon).default([]) });
export type CouponsDoc = z.infer<typeof CouponsDoc>;
