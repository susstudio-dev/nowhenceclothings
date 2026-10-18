import { z } from 'zod';
import { Email, Id, IsoDate, MediaRef, Paise } from './common';

// A10 coming soon + A11 presale. Every per-product field is optional: absent
// means "use the global default from Settings -> Launches".

export const AVAILABILITIES = ['available', 'coming_soon', 'presale', 'sold_out'] as const;
export const Availability = z.enum(AVAILABILITIES);
export type Availability = z.infer<typeof Availability>;

export const PRESALE_ACCESS = ['public', 'code', 'waitlist'] as const;
export const PresaleAccess = z.enum(PRESALE_ACCESS);
export type PresaleAccess = z.infer<typeof PresaleAccess>;

/** A pre-blurred copy of one product image, generated in the admin browser. */
export const BlurredImage = z.object({
  /** Id of the sharp original this was generated from. */
  sourceId: z.string().min(1).max(64),
  strength: z.number().int().min(0).max(100),
  media: MediaRef,
});
export type BlurredImage = z.infer<typeof BlurredImage>;

export const ComingSoonConfig = z.object({
  blur: z.boolean().optional(),
  /** 0-100; maps to a canvas blur radius of strength/1000 of the image width. */
  blurStrength: z.number().int().min(0).max(100).optional(),
  showTitle: z.boolean().optional(),
  showPrice: z.boolean().optional(),
  teaser: z.string().max(500).optional(),
  badge: z.string().max(40).optional(),
  /** When reached, the product switches to `revealTo`. */
  revealAt: IsoDate.optional(),
  revealTo: z.enum(['presale', 'available']).default('available'),
  notify: z.boolean().optional(),
  showInShop: z.boolean().optional(),
  showOnHome: z.boolean().optional(),
  showOnComingSoonPage: z.boolean().optional(),
  /** Placeholder title shown while the real one is hidden. */
  hiddenTitle: z.string().max(80).optional(),
  blurred: z.array(BlurredImage).default([]),
});
export type ComingSoonConfig = z.infer<typeof ComingSoonConfig>;

// ---- A13 pre-booking with deposit -------------------------------------------
export const PRESALE_PAYMENT_MODES = ['full', 'deposit'] as const;
export const PresalePaymentMode = z.enum(PRESALE_PAYMENT_MODES);
export type PresalePaymentMode = z.infer<typeof PresalePaymentMode>;
export const DEPOSIT_TYPES = ['fixed', 'percent'] as const;
export const PRICE_LOCKS = ['booking', 'sale'] as const;
export const UNPAID_OUTCOMES = ['forfeit', 'refund', 'manual'] as const;
export const UnpaidOutcome = z.enum(UNPAID_OUTCOMES);
export type UnpaidOutcome = z.infer<typeof UnpaidOutcome>;

/** Per product / drop deposit settings. Absent fields use Settings -> Launches. */
export const DepositConfig = z.object({
  depositType: z.enum(DEPOSIT_TYPES).optional(),
  /** Paise when fixed; whole percent (1-100) when percent. */
  depositValue: z.number().int().positive().optional(),
  /** Booking window; falls back to the presale startsAt / endsAt. */
  bookingOpensAt: IsoDate.optional(),
  bookingClosesAt: IsoDate.optional(),
  /** When the balance becomes payable. Required for deposit mode to take bookings. */
  saleStartsAt: IsoDate.optional(),
  balanceWindowDays: z.number().int().min(1).max(90).optional(),
  priceLock: z.enum(PRICE_LOCKS).optional(),
  depositRefundable: z.boolean().optional(),
  policyMarkdown: z.string().max(4000).optional(),
  unpaidOutcome: UnpaidOutcome.optional(),
});
export type DepositConfig = z.infer<typeof DepositConfig>;

export const PresaleConfig = z.object({
  enabled: z.boolean().default(false),
  /** A13: 'full' (default) = pay in full at checkout; 'deposit' = pre-book via /book/{slug}. */
  paymentMode: PresalePaymentMode.optional(),
  deposit: DepositConfig.optional(),
  startsAt: IsoDate.optional(),
  endsAt: IsoDate.optional(),
  /** Optional presale price (paise). Falls back to the normal price. */
  price: Paise.optional(),
  /** Total presale units across all SKUs. Unset = unlimited. */
  cap: z.number().int().positive().optional(),
  /** Units per customer email. Unset = global default. */
  perCustomerLimit: z.number().int().positive().optional(),
  /** Estimated ship date, YYYY-MM-DD. */
  shipBy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  shipCopy: z.string().max(300).optional(),
  access: PresaleAccess.optional(),
  /** Never sent to the storefront. */
  accessCode: z.string().max(64).optional(),
  terms: z.string().max(4000).optional(),
  ctaLabel: z.string().max(40).optional(),
  badge: z.string().max(40).optional(),
  autoSwitchAtEnd: z.boolean().optional(),
});
export type PresaleConfig = z.infer<typeof PresaleConfig>;

export const LaunchDefaults = z
  .object({
    comingSoon: z
      .object({
        blur: z.boolean().default(true),
        blurStrength: z.number().int().min(0).max(100).default(30),
        showTitle: z.boolean().default(true),
        showPrice: z.boolean().default(false),
        teaser: z.string().max(500).default('Something new is on the way.'),
        badge: z.string().max(40).default('Coming soon'),
        hiddenTitle: z.string().max(80).default('Untitled piece'),
        notify: z.boolean().default(true),
        showInShop: z.boolean().default(true),
        showOnHome: z.boolean().default(true),
        showOnComingSoonPage: z.boolean().default(true),
      })
      .default({}),
    presale: z
      .object({
        perCustomerLimit: z.number().int().positive().default(2),
        access: PresaleAccess.default('public'),
        shipCopy: z.string().max(300).default('Limited first run. Ships by {date}.'),
        terms: z
          .string()
          .max(4000)
          .default('Pre-orders are paid in full today and ship by the date shown. Pre-orders cannot be combined with in-stock pieces.'),
        ctaLabel: z.string().max(40).default('Pre-order'),
        badge: z.string().max(40).default('Pre-order'),
        autoSwitchAtEnd: z.boolean().default(true),
        /** A13 deposit defaults. */
        deposit: z
          .object({
            depositType: z.enum(DEPOSIT_TYPES).default('fixed'),
            depositValue: z.number().int().positive().default(99900),
            balanceWindowDays: z.number().int().min(1).max(90).default(7),
            priceLock: z.enum(PRICE_LOCKS).default('booking'),
            depositRefundable: z.boolean().default(false),
            policyMarkdown: z
              .string()
              .max(4000)
              .default(
                'Your deposit reserves your size and colour. When the sale starts we email you a private link to pay the balance within the window shown. If the balance is not paid in time, the deposit is handled as stated above.',
              ),
            unpaidOutcome: UnpaidOutcome.default('forfeit'),
            bookCtaLabel: z.string().max(40).default('Pre-book with deposit'),
          })
          .default({}),
      })
      .default({}),
    page: z
      .object({
        title: z.string().max(80).default('Coming soon'),
        intro: z.string().max(1000).default('First looks at what we are making next. Leave your email to hear the moment they land.'),
      })
      .default({}),
    home: z
      .object({
        enabled: z.boolean().default(true),
        heading: z.string().max(80).default('Coming soon'),
        limit: z.number().int().min(1).max(12).default(4),
      })
      .default({}),
  })
  .default({});
export type LaunchDefaults = z.infer<typeof LaunchDefaults>;

// ---- presale/{productId}.json — unit ledger (cap + per-customer limit) ----
export const presaleLedgerKey = (productId: string) => `presale/${productId}.json`;
export const PresaleReservation = z.object({
  orderId: Id,
  email: Email,
  qty: z.number().int().positive(),
  at: IsoDate,
});
export const PresaleLedgerDoc = z.object({
  reservations: z.array(PresaleReservation).default([]),
});
export type PresaleLedgerDoc = z.infer<typeof PresaleLedgerDoc>;

// ---- launch-emails.json — idempotency for "Email the list" ----
export const LAUNCH_EMAILS_KEY = 'launch-emails.json';
export const LaunchEmailsDoc = z.object({
  /** `${productId}:${launchKey}` -> sends */
  sends: z
    .array(z.object({ key: z.string().min(1), at: IsoDate, by: z.string(), recipients: z.array(Email).default([]) }))
    .default([]),
});
export type LaunchEmailsDoc = z.infer<typeof LaunchEmailsDoc>;

/** Notify list for a whole product (A10 notify-me), stored like notify/{sku}.json. */
export const productNotifyKey = (productId: string) => `notify/product-${productId}.json`;
