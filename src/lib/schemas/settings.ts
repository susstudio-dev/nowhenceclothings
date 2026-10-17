import { z } from 'zod';
import { Email, Paise } from './common';

export const SETTINGS_KEY = 'settings.json';

export const SettingsDoc = z.object({
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
      gstin: z.string().default(''),
    })
    .default({}),
  store: z.object({
    name: z.string().default('Nowhence'),
    legalName: z.string().default(''),
    email: Email,
    phone: z.string().default(''),
    address: z.string().default(''),
    instagram: z.string().default(''),
  }),
  orders: z
    .object({
      /** Minutes a pending_payment order stays valid. */
      paymentWindowMinutes: z.number().int().positive().default(30),
      returnWindowDays: z.number().int().nonnegative().default(7),
      /** Max units of a single SKU per order. */
      maxQtyPerLine: z.number().int().positive().default(10),
    })
    .default({}),
  email: z
    .object({
      from: z.string().default('Nowhence <orders@nowhenceclothings.com>'),
      replyTo: z.string().default(''),
    })
    .default({}),
});
export type SettingsDoc = z.infer<typeof SettingsDoc>;
