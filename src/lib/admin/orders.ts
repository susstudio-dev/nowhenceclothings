// Pure order-admin logic (A4): status changes per C9, tracking, refunds,
// filtering and CSV export. No I/O so it is fully unit-tested.
import {
  canTransition,
  ORDER_TRANSITIONS,
  type Order,
  type OrderStatus,
  type OrderSummary,
  type Tracking,
} from '@/lib/schemas/order';

export class OrderTransitionError extends Error {
  constructor(
    public readonly from: OrderStatus,
    public readonly to: OrderStatus,
  ) {
    super(`Cannot move an order from ${from} to ${to}`);
    this.name = 'OrderTransitionError';
  }
}

export function nextStatuses(status: OrderStatus): readonly OrderStatus[] {
  return ORDER_TRANSITIONS[status];
}

export interface OrderPatch {
  status?: OrderStatus;
  /** Note recorded in the order history. */
  note?: string;
  /** null clears tracking. */
  tracking?: Tracking | null;
  /** Internal notes field (replaces). */
  notes?: string;
  refund?: { amount: number; reason?: string; razorpayRefundId?: string };
}

/**
 * Applies an admin patch to an order. Throws OrderTransitionError for a move
 * C9 does not allow. A refund implies status `refunded` and may not exceed the
 * order total. Marking shipped requires tracking (stored or in the patch).
 */
export function applyOrderPatch(order: Order, patch: OrderPatch, by: string, now: Date = new Date()): Order {
  const at = now.toISOString();
  const next: Order = { ...order, history: [...order.history] };

  if (patch.tracking !== undefined) next.tracking = patch.tracking ?? undefined;
  if (patch.notes !== undefined) next.notes = patch.notes;

  let target = patch.status;
  if (patch.refund) {
    if (!Number.isSafeInteger(patch.refund.amount) || patch.refund.amount <= 0) {
      throw new Error('Refund amount must be a positive number of paise');
    }
    if (patch.refund.amount > order.total) throw new Error('Refund cannot exceed the order total');
    target = 'refunded';
    next.refund = {
      amount: patch.refund.amount,
      reason: patch.refund.reason ?? '',
      razorpayRefundId: patch.refund.razorpayRefundId,
      at,
    };
  }

  if (target && target !== order.status) {
    if (!canTransition(order.status, target)) throw new OrderTransitionError(order.status, target);
    if (target === 'shipped' && !next.tracking) throw new Error('Add a tracking number before marking shipped');
    next.status = target;
    next.history.push({ at, status: target, by, ...(patch.note ? { note: patch.note } : {}) });
  } else if (patch.note) {
    next.history.push({ at, status: order.status, by, note: patch.note });
  }
  next.updatedAt = at;
  return next;
}

/** Replace (or insert) a summary in an index list, newest first. */
export function upsertSummary(list: OrderSummary[], summary: OrderSummary): OrderSummary[] {
  const rest = list.filter((s) => s.id !== summary.id);
  return [summary, ...rest].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface OrderFilter {
  status?: OrderStatus | 'all';
  q?: string;
}

export function filterOrders(list: OrderSummary[], f: OrderFilter): OrderSummary[] {
  const q = f.q?.trim().toLowerCase();
  return list.filter((o) => {
    if (f.status && f.status !== 'all' && o.status !== f.status) return false;
    if (q && !`${o.number} ${o.email} ${o.name}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** RFC 4180 field escaping plus a guard against spreadsheet formula injection. */
export function csvField(value: unknown): string {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

const rupees = (paise: number) => (paise / 100).toFixed(2);

export const ORDER_CSV_HEADER = [
  'number', 'created_at', 'status', 'name', 'email', 'phone', 'city', 'state', 'pincode',
  'items', 'subtotal_inr', 'discount_inr', 'shipping_inr', 'total_inr', 'coupon',
  'razorpay_payment_id', 'tracking_carrier', 'tracking_number', 'refund_inr',
];

/** One row per order; line items flattened as "SKU x qty; ...". */
export function ordersToCsv(orders: Order[]): string {
  const rows = orders.map((o) => [
    o.number, o.createdAt, o.status, o.shippingAddress.name, o.email, o.phone,
    o.shippingAddress.city, o.shippingAddress.state, o.shippingAddress.pincode,
    o.lines.map((l) => `${l.sku} x ${l.qty}`).join('; '),
    rupees(o.subtotal), rupees(o.discount), rupees(o.shipping), rupees(o.total),
    o.couponCode ?? '', o.razorpayPaymentId ?? '', o.tracking?.carrier ?? '', o.tracking?.number ?? '',
    o.refund ? rupees(o.refund.amount) : '',
  ]);
  return [ORDER_CSV_HEADER, ...rows].map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n';
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: 'Pending payment',
  paid: 'Paid',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  exchange_requested: 'Exchange requested',
};
