import { z } from 'zod';
import { Address, Email, IsoDate, Paise } from './common';

// A14 GST documents. One JSON per document at invoices/{fy}/{slug}.json, its
// PDF next to it, and one CAS counter per financial year.

export const INVOICE_KINDS = ['invoice', 'receipt', 'credit_note'] as const;
export const InvoiceKind = z.enum(INVOICE_KINDS);
export type InvoiceKind = z.infer<typeof InvoiceKind>;

/** "NWH/25-26/0001" → "NWH-25-26-0001" (safe in keys and file names). */
export const invoiceSlug = (number: string) => number.replace(/[^A-Za-z0-9-]+/g, '-');
export const invoiceCounterKey = (fy: string) => `invoices/counter-${fy}.json`;
export const invoiceDocKey = (fy: string, number: string) => `invoices/${fy}/${invoiceSlug(number)}.json`;
/** PDF bytes, stored base64-encoded (text store). */
export const invoicePdfKey = (fy: string, number: string) => `invoices/${fy}/${invoiceSlug(number)}.pdf`;

export const InvoiceCounterDoc = z.object({
  fy: z.string(),
  invoice: z.number().int().nonnegative().default(0),
  receipt: z.number().int().nonnegative().default(0),
  credit_note: z.number().int().nonnegative().default(0),
  /** `${kind}:${sourceId}` → number already issued (idempotency; no gaps on races). */
  assigned: z.record(z.string()).default({}),
});
export type InvoiceCounterDoc = z.infer<typeof InvoiceCounterDoc>;

const Party = z.object({
  legalName: z.string(),
  gstin: z.string().default(''),
  address: z.string().default(''),
  state: z.string().default(''),
  stateCode: z.string().default(''),
});

export const InvoiceLine = z.object({
  description: z.string(),
  hsn: z.string(),
  qty: z.number().int().positive(),
  /** GST-inclusive unit price before discount. */
  unitPrice: Paise,
  gross: Paise,
  discount: Paise,
  taxable: Paise,
  ratePercent: z.number().min(0).max(28),
  cgst: Paise,
  sgst: Paise,
  igst: Paise,
  /** taxable + tax = gross − discount. */
  total: Paise,
});
export type InvoiceLine = z.infer<typeof InvoiceLine>;

export const InvoiceDoc = z.object({
  kind: InvoiceKind,
  number: z.string().min(1),
  fy: z.string(),
  seq: z.number().int().positive(),
  issuedAt: IsoDate,
  source: z.object({ type: z.enum(['order', 'booking']), id: z.string(), number: z.string() }),
  /** Credit note → the invoice / receipt it reverses. Invoice → the receipt adjusted. */
  reference: z.string().optional(),
  seller: Party,
  buyer: z.object({
    name: z.string(),
    email: Email,
    phone: z.string(),
    gstin: z.string().optional(),
    billing: Address,
    shipping: Address,
  }),
  placeOfSupply: z.object({ state: z.string(), code: z.string() }),
  intraState: z.boolean(),
  lines: z.array(InvoiceLine),
  totals: z.object({
    gross: Paise,
    discount: Paise,
    taxable: Paise,
    cgst: Paise,
    sgst: Paise,
    igst: Paise,
    tax: Paise,
    total: Paise,
  }),
  /** Advance (booking deposit) adjusted against this invoice. */
  advanceAdjusted: Paise.default(0),
  amountPayable: Paise,
  amountInWords: z.string(),
  notes: z.array(z.string()).default([]),
});
export type InvoiceDoc = z.infer<typeof InvoiceDoc>;
