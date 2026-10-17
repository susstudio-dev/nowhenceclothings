import { z } from 'zod';
import { Address, Email, Id, IsoDate, Paise, Phone, Size } from './common';
import { PRICE_LOCKS, UnpaidOutcome } from './launches';

// A13 pre-booking with deposit. One object per booking, plus a monthly index,
// a token-hash map (the raw token is never stored) and a Razorpay order map.

export const bookingKey = (id: string) => `bookings/${id}.json`;
export const bookingsIndexKey = (createdAt: string | Date) =>
  `bookings-index/${new Date(createdAt).toISOString().slice(0, 7)}.json`;
export const BOOKINGS_INDEX_PREFIX = 'bookings-index/';
export const bookingTokenKey = (hashHex: string) => `booking-tokens/${hashHex}.json`;
export const razorpayBookingKey = (rzpOrderId: string) => `razorpay-bookings/${rzpOrderId}.json`;

export const BOOKING_STATUSES = [
  'deposit_pending',
  'deposit_paid',
  'balance_due',
  'completed',
  'expired',
  'cancelled',
  'refunded',
] as const;
export const BookingStatus = z.enum(BOOKING_STATUSES);
export type BookingStatus = z.infer<typeof BookingStatus>;

export const BOOKING_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  deposit_pending: ['deposit_paid', 'cancelled'],
  deposit_paid: ['balance_due', 'cancelled', 'refunded'],
  balance_due: ['completed', 'expired', 'cancelled', 'refunded'],
  // Admin "extend deadline" re-opens an expired booking.
  expired: ['balance_due', 'refunded', 'cancelled'],
  cancelled: ['refunded'],
  completed: [],
  refunded: [],
};

export function canBookingTransition(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from].includes(to);
}

/** NWB-YYMMDD-XXXX */
export const BookingNumber = z.string().regex(/^NWB-\d{6}-[A-Z0-9]{4}$/);

export const BOOKING_EMAILS = ['deposit_paid', 'balance_due', 'expired', 'refunded', 'cancelled', 'sale_date_moved'] as const;
export const BookingEmailKind = z.enum(BOOKING_EMAILS);
export type BookingEmailKind = z.infer<typeof BookingEmailKind>;

export const BookingHistoryEntry = z.object({
  at: IsoDate,
  status: BookingStatus,
  by: z.string().min(1),
  note: z.string().optional(),
});

export const BalanceAttempt = z.object({
  razorpayOrderId: z.string().min(1),
  amount: Paise,
  finalUnitPrice: Paise,
  subtotal: Paise,
  shipping: Paise,
  address: Address,
  phone: Phone,
  createdAt: IsoDate,
});
export type BalanceAttempt = z.infer<typeof BalanceAttempt>;

export const Booking = z.object({
  id: Id,
  number: BookingNumber,
  status: BookingStatus,
  email: Email,
  name: z.string().trim().min(1).max(100),
  phone: Phone,
  /** A15: address captured at booking (prefills the balance checkout). */
  address: Address.optional(),
  billingAddress: Address.optional(),
  buyerGstin: z.string().regex(/^\d{2}[A-Z0-9]{13}$/).optional(),
  /** A14: receipt voucher for the deposit; credit note on refund. */
  receipt: z.object({ number: z.string().min(1), fy: z.string().min(1), issuedAt: IsoDate }).optional(),
  creditNote: z.object({ number: z.string().min(1), fy: z.string().min(1), issuedAt: IsoDate }).optional(),
  productId: Id,
  productSlug: z.string().min(1),
  productTitle: z.string().min(1),
  sku: z.string().min(1),
  colour: z.string().min(1),
  size: Size,
  qty: z.number().int().min(1).max(10),
  /** Unit price at booking time (presale price or the live price). */
  lockedUnitPrice: Paise,
  /** Frozen at sale start (priceLock 'sale') or equal to lockedUnitPrice. */
  finalUnitPrice: Paise.optional(),
  deposit: Paise,
  /** Snapshot of the terms the customer agreed to. */
  terms: z.object({
    priceLock: z.enum(PRICE_LOCKS),
    depositRefundable: z.boolean(),
    unpaidOutcome: UnpaidOutcome,
    saleStartsAt: IsoDate,
    balanceWindowDays: z.number().int().min(1).max(365),
    policy: z.string().max(4000).default(''),
  }),
  balanceDueBy: IsoDate.optional(),
  /** SHA-256 (hex) of every balance-link token issued. Raw tokens are never stored. */
  tokenHashes: z.array(z.string().regex(/^[0-9a-f]{64}$/)).max(20),
  depositRazorpayOrderId: z.string().min(1),
  depositPaymentId: z.string().optional(),
  balanceAttempts: z.array(BalanceAttempt).max(10).default([]),
  balancePaymentId: z.string().optional(),
  balanceRazorpayOrderId: z.string().optional(),
  orderId: Id.optional(),
  orderNumber: z.string().optional(),
  refund: z
    .object({ amount: Paise, razorpayRefundId: z.string().optional(), at: IsoDate, reason: z.string().default('') })
    .optional(),
  /** Expired with outcome 'manual', or a refund that needs doing by hand. */
  needsReview: z.boolean().optional(),
  emailsSent: z.array(BookingEmailKind).default([]),
  /** F23: saleTermsKey of the last sale-date change the customer was emailed about. */
  saleDateEmailFor: z.string().max(80).optional(),
  history: z.array(BookingHistoryEntry).min(1),
  notes: z.string().default(''),
  createdAt: IsoDate,
  updatedAt: IsoDate,
});
export type Booking = z.infer<typeof Booking>;

export const BookingSummary = z.object({
  id: Id,
  number: BookingNumber,
  status: BookingStatus,
  email: Email,
  name: z.string(),
  productId: Id,
  productTitle: z.string(),
  sku: z.string(),
  colour: z.string(),
  size: Size,
  qty: z.number().int(),
  deposit: Paise,
  depositPaid: z.boolean(),
  saleStartsAt: IsoDate,
  balanceDueBy: IsoDate.optional(),
  orderNumber: z.string().optional(),
  needsReview: z.boolean().optional(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
});
export type BookingSummary = z.infer<typeof BookingSummary>;

export const BookingsIndexDoc = z.object({ bookings: z.array(BookingSummary).default([]) });
export type BookingsIndexDoc = z.infer<typeof BookingsIndexDoc>;

export const BookingTokenDoc = z.object({ bookingId: Id, createdAt: IsoDate });
export const RazorpayBookingDoc = z.object({
  bookingId: Id,
  kind: z.enum(['deposit', 'balance']),
  createdAt: IsoDate,
});
export type RazorpayBookingDoc = z.infer<typeof RazorpayBookingDoc>;

export function summarizeBooking(b: Booking): BookingSummary {
  return {
    id: b.id,
    number: b.number,
    status: b.status,
    email: b.email,
    name: b.name,
    productId: b.productId,
    productTitle: b.productTitle,
    sku: b.sku,
    colour: b.colour,
    size: b.size,
    qty: b.qty,
    deposit: b.deposit,
    depositPaid: !!b.depositPaymentId,
    saleStartsAt: b.terms.saleStartsAt,
    ...(b.balanceDueBy ? { balanceDueBy: b.balanceDueBy } : {}),
    ...(b.orderNumber ? { orderNumber: b.orderNumber } : {}),
    ...(b.needsReview ? { needsReview: true } : {}),
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}
