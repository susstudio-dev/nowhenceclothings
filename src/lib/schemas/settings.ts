import { z } from 'zod';
import { Email, MediaRef, Paise } from './common';
import { LaunchDefaults } from './launches';

export const SETTINGS_KEY = 'settings.json';

/**
 * Curated font families (A9b). Each is pre-registered with next/font in
 * components/chrome/fonts.ts as the CSS variable `--font-{key}`, so switching
 * fonts in admin is a CSS-variable change, no rebuild.
 */
export const BRAND_FONTS = [
  'cormorant-garamond',
  'playfair-display',
  'fraunces',
  'dm-serif-display',
  'inter-tight',
  'inter',
  'dm-sans',
  'manrope',
  'jost',
] as const;
export const BrandFont = z.enum(BRAND_FONTS);
export type BrandFont = z.infer<typeof BrandFont>;

const HexColour = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex colour like #161513');

/** Monochrome defaults (A12) so the earthy product colours carry. */
export const DEFAULT_BRAND_COLOURS = { ink: '#0b0b0b', paper: '#f4f4f2', accent: '#6b6b67' } as const;

export const DEFAULT_RETURNS_POLICY = `## Conditions

- Unworn, unwashed, with original tags attached.
- Pieces bought on final sale cannot be returned.
- Innerwear and socks cannot be returned, for hygiene.

## Refunds

Once we receive and check the piece, we refund to the original payment method within 5 to 7 working days. Shipping fees are not refunded.`;

const Brand = z
  .object({
    /** Logo for light backgrounds. Falls back to the typeset wordmark. */
    logoLight: MediaRef.optional(),
    /** Logo for dark backgrounds. */
    logoDark: MediaRef.optional(),
    favicon: MediaRef.optional(),
    wordmark: z.string().trim().max(40).default('NOWHENCE'),
    displayFont: BrandFont.default('jost'),
    bodyFont: BrandFont.default('inter-tight'),
    colours: z
      .object({
        ink: HexColour.default(DEFAULT_BRAND_COLOURS.ink),
        paper: HexColour.default(DEFAULT_BRAND_COLOURS.paper),
        accent: HexColour.default(DEFAULT_BRAND_COLOURS.accent),
      })
      .default({}),
  })
  .default({});

const Returns = z
  .object({
    exchangesAllowed: z.boolean().default(true),
    returnsAllowed: z.boolean().default(true),
    /** Days from delivery. Canonical; `orders.returnWindowDays` mirrors it. */
    windowDays: z.number().int().nonnegative().max(365).default(7),
    /** Conditions + refunds markdown shown on /returns. */
    policyMarkdown: z.string().max(20000).default(DEFAULT_RETURNS_POLICY),
  })
  .default({});

/** ISO date `YYYY-MM-DD` or empty (not yet set). */
const IsoDateOrEmpty = z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).default('');

const Legal = z
  .object({
    /** Canonical; `store.legalName` mirrors it. */
    legalName: z.string().trim().max(200).default(''),
    /** Canonical; `tax.gstin` mirrors it. */
    gstin: z.string().trim().max(15).default(''),
    registeredAddress: z.string().trim().max(500).default(''),
    jurisdictionCity: z.string().trim().max(80).default(''),
    privacyUpdatedAt: IsoDateOrEmpty,
    termsUpdatedAt: IsoDateOrEmpty,
  })
  .default({});

const SettingsShape = z.object({
  /** F13: ISO timestamp of the last save; the admin form echoes it back as an optimistic-concurrency precondition. */
  updatedAt: z.string().default(''),
  currency: z.literal('INR').default('INR'),
  shipping: z.object({
    /** Flat shipping fee, paise (D10). */
    flatFee: Paise,
    /** Merchandise subtotal at/above which shipping is free, paise. */
    freeShippingThreshold: Paise,
    /** Display copy, e.g. "Ships in 2-4 working days". */
    eta: z.string().default(''),
  }),
  tax: z
    .object({
      /** Prices are GST-inclusive (D5); rate is for invoice breakdown only. */
      pricesIncludeTax: z.literal(true).default(true),
      gstRatePercent: z.number().min(0).max(28).default(12),
      /** Legacy mirror of `legal.gstin` (read-only; kept for existing readers). */
      gstin: z.string().default(''),
    })
    .default({}),
  store: z.object({
    name: z.string().default('Nowhence'),
    /** Legacy mirror of `legal.legalName` (read-only; kept for existing readers). */
    legalName: z.string().default(''),
    email: Email,
    phone: z.string().default(''),
    /** Contact / studio address. */
    address: z.string().default(''),
    instagram: z.string().default(''),
  }),
  orders: z
    .object({
      /** Minutes a pending_payment order stays valid. */
      paymentWindowMinutes: z.number().int().positive().default(30),
      /** Legacy mirror of `returns.windowDays` (read-only; kept for existing readers). */
      returnWindowDays: z.number().int().nonnegative().default(7),
      /** Max units of a single SKU per order. */
      maxQtyPerLine: z.number().int().positive().default(10),
    })
    .default({}),
  email: z
    .object({
      /** Display name on outgoing email, e.g. "Nowhence". */
      senderName: z.string().trim().max(80).default(''),
      from: z.string().default('Nowhence <orders@nowhenceclothings.com>'),
      replyTo: z.string().default(''),
    })
    .default({}),
  brand: Brand,
  returns: Returns,
  legal: Legal,
  /** A10/A11 global defaults (Settings -> Launches). */
  launches: LaunchDefaults,
});

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw | undefined => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : undefined);

/**
 * Migrate pre-A9 docs: when `legal` / `returns` are absent, seed them from the
 * legacy fields they replace. Pure; exported for tests.
 */
export function migrateSettingsInput(input: unknown): unknown {
  const doc = obj(input);
  if (!doc) return input;
  const out: Raw = { ...doc };
  const store = obj(doc.store) ?? {};
  const tax = obj(doc.tax) ?? {};
  const orders = obj(doc.orders) ?? {};
  if (!obj(doc.legal)) {
    out.legal = {
      legalName: typeof store.legalName === 'string' ? store.legalName : '',
      gstin: typeof tax.gstin === 'string' ? tax.gstin : '',
      registeredAddress: typeof store.address === 'string' ? store.address : '',
    };
  }
  if (!obj(doc.returns) && typeof orders.returnWindowDays === 'number') {
    out.returns = { windowDays: orders.returnWindowDays };
  }
  return out;
}

export const SettingsDoc = z.preprocess(
  migrateSettingsInput,
  SettingsShape.transform((s) => ({
    ...s,
    // Keep legacy mirrors in sync with the canonical A9 fields.
    store: { ...s.store, legalName: s.legal.legalName },
    tax: { ...s.tax, gstin: s.legal.gstin },
    orders: { ...s.orders, returnWindowDays: s.returns.windowDays },
  })),
);
export type SettingsDoc = z.infer<typeof SettingsDoc>;

export const SETTINGS_STALE_MESSAGE = 'Settings changed elsewhere — reload to see the latest';

/** F13: true when the form's loaded `updatedAt` no longer matches the stored doc. Pure. */
export function isStaleSettingsWrite(stored: Pick<SettingsDoc, 'updatedAt'> | null, sentUpdatedAt: string): boolean {
  return (stored?.updatedAt ?? '') !== sentUpdatedAt;
}
