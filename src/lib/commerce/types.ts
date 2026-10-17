// Request shapes shared by the cart/checkout UI and the API routes.
// Client-safe: no server imports.

import { z } from 'zod';
import { Address, Email, Phone } from '@/lib/schemas/common';

export const CartRequestLine = z.object({
  sku: z.string().min(1).max(40),
  qty: z.number().int().min(1).max(10),
});
export type CartRequestLine = z.infer<typeof CartRequestLine>;

export const QuoteRequest = z.object({
  lines: z.array(CartRequestLine).max(50),
  couponCode: z.string().trim().max(32).optional(),
});
export type QuoteRequest = z.infer<typeof QuoteRequest>;

export const CheckoutRequest = QuoteRequest.extend({
  lines: z.array(CartRequestLine).min(1).max(50),
  email: Email,
  phone: Phone,
  address: Address,
  /** A11: access code for code-gated pre-orders (verified server-side). */
  presaleAccessCode: z.string().trim().max(64).optional(),
  /** A15: separate billing address (absent = same as shipping). */
  billingAddress: Address.optional(),
  /** A14: optional buyer GSTIN. */
  gstin: z.string().trim().toUpperCase().max(15).optional(),
});
export type CheckoutRequest = z.infer<typeof CheckoutRequest>;

export const VerifyRequest = z.object({
  razorpay_order_id: z.string().min(1).max(64),
  razorpay_payment_id: z.string().min(1).max(64),
  razorpay_signature: z.string().min(1).max(128),
});

export const TrackRequest = z.object({
  number: z.string().trim().toUpperCase(),
  email: Email,
});

export type LineIssue =
  | 'unknown'
  | 'unavailable'
  | 'not_released'
  | 'out_of_stock'
  | 'insufficient_stock'
  /** A11: in-stock line in a bag that also holds pre-order pieces. */
  | 'mixed_presale'
  /** F19: pre-order qty above the presale per-customer limit (qty clamped). */
  | 'presale_limit';

export interface QuoteLine {
  sku: string;
  productId: string;
  slug: string;
  title: string;
  colour: string;
  size: string;
  qty: number;
  unitPrice: number;
  compareAtPrice?: number;
  lineTotal: number;
  image?: string;
  /** Units purchasable now. */
  available: number;
  /** A11: pre-order line (ships later). */
  preorder?: boolean;
  /** A11: this pre-order line's own ship date / copy. */
  shipBy?: string;
  shipCopy?: string;
}

export interface QuoteResponse {
  lines: QuoteLine[];
  issues: { sku: string; issue: LineIssue; available?: number }[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  couponCode?: string;
  couponError?: string;
  freeShippingThreshold: number;
  freeShippingRemaining: number;
  shippingEta: string;
  /** A11: set when the bag holds pre-order pieces. */
  preorder?: { shipBy?: string; shipCopy: string; access: 'public' | 'code' | 'waitlist'; terms: string };
  /** A11: pre-order and in-stock pieces cannot be checked out together. */
  mixedPresale?: boolean;
}

/** What /api/checkout returns so the browser can open Checkout.js. */
export interface CheckoutResponse {
  orderId: string;
  number: string;
  razorpay: {
    key: string;
    orderId: string;
    amount: number;
    currency: 'INR';
    name: string;
    prefill: { name: string; email: string; contact: string };
  };
}

/** Public, customer-facing order view (no internal notes or ids). */
export interface PublicOrder {
  number: string;
  status: string;
  createdAt: string;
  /** `sku` lets the confirmation page report content_ids to analytics. */
  lines: { sku?: string; title: string; colour: string; size: string; qty: number; unitPrice: number; image?: string }[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  couponCode?: string;
  shippingAddress: { name: string; city: string; state: string; pincode: string };
  tracking?: { carrier: string; number: string; url?: string };
  history: { at: string; status: string }[];
  /** A13/A11: pre-order / booking context for the timeline. */
  preorder?: boolean;
  shipBy?: string;
  depositPaid?: number;
  /** A14: invoice / credit note download links (signed). */
  documents?: { kind: string; label: string; number: string; url: string }[];
}
