import { z } from 'zod';
import { Address, Email, Id, IsoDate, Paise, Phone, Size } from './common';

/** `orders/{orderId}.json` — one object per order. */
export const orderKey = (orderId: string) => `orders/${orderId}.json`;
/** `orders-index/{yyyy-mm}.json` — lightweight summaries for admin lists. */
export const ordersIndexKey = (createdAt: string | Date) =>
  `orders-index/${new Date(createdAt).toISOString().slice(0, 7)}.json`;

/** C9 state machine. */
export const ORDER_STATUSES = [
  'pending_payment',
  'paid',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
  'exchange_requested',
] as const;
export const OrderStatus = z.enum(ORDER_STATUSES);
export type OrderStatus = z.infer<typeof OrderStatus>;

/** Allowed transitions. Anything not listed is rejected. */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ['paid', 'cancelled'],
  paid: ['packed', 'cancelled', 'refunded'],
  packed: ['shipped', 'cancelled', 'refunded'],
  shipped: ['delivered', 'refunded'],
  delivered: ['exchange_requested', 'refunded'],
  exchange_requested: ['delivered', 'refunded'],
  cancelled: ['refunded'],
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

/** NWH-YYMMDD-XXXX (XXXX = 4 upper-case base-36 chars). */
export const OrderNumber = z.string().regex(/^NWH-\d{6}-[A-Z0-9]{4}$/);

export function newOrderNumber(now: Date = new Date()): string {
  const yy = String(now.getUTCFullYear()).slice(2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rnd = crypto.getRandomValues(new Uint8Array(4));
  const tail = Array.from(rnd, (b) => alphabet[b % alphabet.length]).join('');
  return `NWH-${yy}${mm}${dd}-${tail}`;
}

export const OrderLine = z.object({
  sku: z.string().min(1),
  productId: Id,
  title: z.string().min(1),
  colour: z.string().min(1),
  size: Size,
  qty: z.number().int().min(1).max(10),
  /** Server-computed unit price at order time (GST-inclusive), paise. */
  unitPrice: Paise,
  /** unitPrice before sale, for receipts. */
  compareAtPrice: Paise.optional(),
  image: z.string().optional(),
});
export type OrderLine = z.infer<typeof OrderLine>;

export const OrderHistoryEntry = z.object({
  at: IsoDate,
  status: OrderStatus,
  /** Admin email, 'system', 'webhook' or 'customer'. */
  by: z.string().min(1),
  note: z.string().optional(),
});
export type OrderHistoryEntry = z.infer<typeof OrderHistoryEntry>;

export const Tracking = z.object({
  carrier: z.string().min(1),
  number: z.string().min(1),
  url: z.string().url().optional(),
});
export type Tracking = z.infer<typeof Tracking>;

export const Order = z.object({
  id: Id,
  number: OrderNumber,
  email: Email,
  phone: Phone,
  shippingAddress: Address,
  /** A15: billing address when different from shipping. */
  billingAddress: Address.optional(),
  /** A14: optional buyer GSTIN (B2B invoice). */
  buyerGstin: z.string().regex(/^\d{2}[A-Z0-9]{13}$/).optional(),
  /** A14: tax invoice / credit note references (see src/lib/invoices). */
  invoice: z.object({ number: z.string().min(1), fy: z.string().min(1), issuedAt: IsoDate }).optional(),
  creditNote: z.object({ number: z.string().min(1), fy: z.string().min(1), issuedAt: IsoDate }).optional(),
  lines: z.array(OrderLine).min(1),
  subtotal: Paise,
  discount: Paise,
  shipping: Paise,
  total: Paise,
  couponCode: z.string().optional(),
  status: OrderStatus,
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().optional(),
  tracking: Tracking.optional(),
  refund: z
    .object({ amount: Paise, razorpayRefundId: z.string().optional(), at: IsoDate, reason: z.string().default('') })
    .optional(),
  /** Set once stock + coupon usage are applied (idempotency guard for verify/webhook). */
  stockCommittedAt: IsoDate.optional(),
  /** Emails already sent, to keep sends idempotent. */
  emailsSent: z.array(z.enum(['confirmation', 'shipped', 'refunded'])).default([]),
  history: z.array(OrderHistoryEntry).min(1),
  notes: z.string().default(''),
  /** A11: presale order (paid in full now, ships later). */
  preorder: z.boolean().optional(),
  /** A11: estimated ship-by date (YYYY-MM-DD) for pre-orders. */
  shipBy: z.string().optional(),
  /** A13: order converted from a pre-booking (deposit shown as `discount`). */
  bookingId: Id.optional(),
  /** A13: deposit already paid against this order, paise. */
  depositPaid: Paise.optional(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
});
export type Order = z.infer<typeof Order>;

export const OrderSummary = z.object({
  id: Id,
  number: OrderNumber,
  email: Email,
  name: z.string(),
  total: Paise,
  status: OrderStatus,
  itemCount: z.number().int().nonnegative(),
  preorder: z.boolean().optional(),
  shipBy: z.string().optional(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
});
export type OrderSummary = z.infer<typeof OrderSummary>;

export const OrdersIndexDoc = z.object({ orders: z.array(OrderSummary).default([]) });
export type OrdersIndexDoc = z.infer<typeof OrdersIndexDoc>;

export function summarize(o: Order): OrderSummary {
  return {
    id: o.id,
    number: o.number,
    email: o.email,
    name: o.shippingAddress.name,
    total: o.total,
    status: o.status,
    itemCount: o.lines.reduce((n, l) => n + l.qty, 0),
    ...(o.preorder ? { preorder: true, ...(o.shipBy ? { shipBy: o.shipBy } : {}) } : {}),
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}
