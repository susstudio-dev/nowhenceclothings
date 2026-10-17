// Order lifecycle on R2 (C5–C9): create on checkout, confirm on verified
// payment (client callback and webhook, idempotent), stock + coupon commit,
// oversell refund, emails, customer lookup.

import 'server-only';
import { inventoryLines } from './order-lines';
import { z } from 'zod';
import { getSettings } from '@/lib/content';
import { createJson, readJson, writeJsonCas } from '@/lib/storage';
import { COUPONS_KEY, CouponsDoc } from '@/lib/schemas/coupons';
import { PaymentEventsDoc, paymentEventsKey, type PaymentEvent } from '@/lib/schemas/logs';
import {
  Order,
  OrdersIndexDoc,
  canTransition,
  orderKey,
  ordersIndexKey,
  summarize,
  type OrderStatus,
} from '@/lib/schemas/order';
import { renderOrderEmail, sendEmail, type OrderEmailKind } from './email';
import { razorpayConfig, refundPayment } from './razorpay';
import { commitStock, OversellError } from './stock';
import type { PublicOrder } from './types';

// ---- razorpay order id → our order id -------------------------------------
export const razorpayMapKey = (rzpOrderId: string) => `razorpay-orders/${rzpOrderId}.json`;
export const RazorpayMapDoc = z.object({ orderId: z.string().min(1), createdAt: z.string() });

export async function orderIdForRazorpayOrder(rzpOrderId: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_]{1,64}$/.test(rzpOrderId)) return null;
  return (await readJson(razorpayMapKey(rzpOrderId), RazorpayMapDoc))?.orderId ?? null;
}

export function readOrder(id: string): Promise<Order | null> {
  return readJson(orderKey(id), Order);
}

/** Upsert the order's summary into its monthly index (CAS). Best effort. */
export async function syncOrderIndex(order: Order): Promise<void> {
  try {
    await writeJsonCas(
      ordersIndexKey(order.createdAt),
      OrdersIndexDoc,
      (cur) => {
        const orders = (cur?.orders ?? []).filter((o) => o.id !== order.id);
        orders.push(summarize(order));
        orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return { orders };
      },
      { initial: () => ({ orders: [] }) },
    );
  } catch (err) {
    console.error('orders-index: sync failed', order.number, err instanceof Error ? err.message : '');
  }
}

/** Persist a new pending order plus its razorpay map + index row. */
export async function saveNewOrder(order: Order): Promise<void> {
  const ok = await createJson(orderKey(order.id), Order, order);
  if (!ok) throw new Error(`order ${order.id} already exists`);
  await createJson(razorpayMapKey(order.razorpayOrderId), RazorpayMapDoc, {
    orderId: order.id,
    createdAt: order.createdAt,
  });
  await syncOrderIndex(order);
}

/**
 * CAS-update an order. `mutate` returns the next order or null for "no
 * change". Returns `{ order, changed }`.
 */
export async function updateOrder(
  id: string,
  mutate: (o: Order) => Order | null,
): Promise<{ order: Order; changed: boolean }> {
  let changed = false;
  const order = await writeJsonCas(orderKey(id), Order, (cur) => {
    if (!cur) throw new Error(`order ${id} not found`);
    const next = mutate(cur);
    changed = next !== null;
    return next ?? cur;
  });
  if (changed) await syncOrderIndex(order);
  return { order, changed };
}

/** Transition with history; throws on an illegal transition. Pure. */
export function withStatus(o: Order, to: OrderStatus, by: string, note?: string, now = new Date()): Order {
  if (o.status === to) return o;
  if (!canTransition(o.status, to)) throw new Error(`illegal transition ${o.status} → ${to}`);
  const at = now.toISOString();
  return { ...o, status: to, updatedAt: at, history: [...o.history, { at, status: to, by, ...(note ? { note } : {}) }] };
}

// ---- payment events log ----------------------------------------------------

/** Appends an event; returns false if `eventId` was already recorded. */
export async function recordPaymentEvent(ev: PaymentEvent): Promise<boolean> {
  let fresh = false;
  await writeJsonCas(
    paymentEventsKey(ev.at),
    PaymentEventsDoc,
    (cur) => {
      const events = cur?.events ?? [];
      fresh = !events.some((e) => e.eventId === ev.eventId);
      return fresh ? { events: [...events, ev] } : { events };
    },
    { initial: () => ({ events: [] }) },
  );
  return fresh;
}

// ---- emails ----------------------------------------------------------------

/**
 * Send an order email at most once (tracked in `order.emailsSent`). Never
 * throws. Exported for admin (WS-D) to send `shipped` / `refunded`.
 */
export async function sendOrderEmailOnce(orderId: string, kind: OrderEmailKind): Promise<boolean> {
  try {
    const order = await readOrder(orderId);
    if (!order || order.emailsSent.includes(kind)) return false;
    const settings = await getSettings();
    const res = await sendEmail(renderOrderEmail(order, kind, settings));
    if (!res.sent) {
      if (res.reason === 'error') console.error('email failed', kind, order.number, res.detail);
      return false;
    }
    await updateOrder(orderId, (o) => (o.emailsSent.includes(kind) ? null : { ...o, emailsSent: [...o.emailsSent, kind] }));
    return true;
  } catch (err) {
    console.error('sendOrderEmailOnce', kind, err instanceof Error ? err.message : '');
    return false;
  }
}

// ---- coupon usage ----------------------------------------------------------

export async function bumpCouponUsage(code: string): Promise<void> {
  try {
    await writeJsonCas(COUPONS_KEY, CouponsDoc, (cur) => {
      if (!cur) throw new Error('coupons.json missing');
      return { coupons: cur.coupons.map((c) => (c.code === code ? { ...c, usedCount: c.usedCount + 1 } : c)) };
    });
  } catch (err) {
    console.error('coupon usage bump failed', code, err instanceof Error ? err.message : '');
  }
}

// ---- payment confirmation ---------------------------------------------------

export type ConfirmResult =
  | { result: 'applied'; order: Order }
  | { result: 'duplicate'; order: Order }
  | { result: 'oversell_refunded'; order: Order }
  | { result: 'amount_mismatch'; order: Order }
  | { result: 'not_found' }
  | { result: 'ignored'; order: Order };

/**
 * Mark an order paid after a verified signature. Idempotent and race-safe:
 * the pending→paid CAS on the order doc elects exactly one caller (callback
 * or webhook) to commit stock, bump the coupon and send email.
 */
export async function confirmPayment(p: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  /** Captured amount from the webhook payload, when known. */
  amount?: number;
  by: 'customer' | 'webhook';
  stockKey?: string;
}): Promise<ConfirmResult> {
  const orderId = await orderIdForRazorpayOrder(p.razorpayOrderId);
  if (!orderId) return { result: 'not_found' };
  const existing = await readOrder(orderId);
  if (!existing) return { result: 'not_found' };
  if (p.amount != null && p.amount !== existing.total) return { result: 'amount_mismatch', order: existing };

  let won = false;
  const { order: paid } = await updateOrder(orderId, (o) => {
    won = false;
    if (o.status !== 'pending_payment') return null;
    won = true;
    return { ...withStatus(o, 'paid', p.by), razorpayPaymentId: p.razorpayPaymentId };
  });

  if (!won) {
    if (paid.status === 'cancelled' && !paid.refund && paid.razorpayPaymentId == null) {
      // Paid after we cancelled (payment window expired): refund it.
      return refundOrder(paid, p.razorpayPaymentId, 'Payment received after the order was cancelled', 'oversell_refunded');
    }
    return { result: paid.status === 'pending_payment' ? 'ignored' : 'duplicate', order: paid };
  }

  try {
    await commitStock(
      inventoryLines(paid),
      p.stockKey,
    );
  } catch (err) {
    if (err instanceof OversellError) {
      return refundOrder(paid, p.razorpayPaymentId, 'Sold out before payment completed', 'oversell_refunded');
    }
    throw err;
  }

  const { order } = await updateOrder(orderId, (o) => (o.stockCommittedAt ? null : { ...o, stockCommittedAt: new Date().toISOString() }));
  if (order.couponCode) await bumpCouponUsage(order.couponCode);
  await sendOrderEmailOnce(orderId, 'confirmation');
  return { result: 'applied', order };
}

async function refundOrder(
  order: Order,
  paymentId: string,
  reason: string,
  result: 'oversell_refunded',
): Promise<ConfirmResult> {
  const cfg = razorpayConfig();
  let refundId: string | undefined;
  if (cfg) {
    try {
      refundId = (await refundPayment(cfg, paymentId, order.total, { order: order.number })).id;
    } catch (err) {
      console.error('refund failed — needs manual refund', order.number, err instanceof Error ? err.message : '');
    }
  }
  const { order: updated } = await updateOrder(order.id, (o) => {
    if (o.refund) return null;
    const base = canTransition(o.status, 'refunded') ? withStatus(o, 'refunded', 'system', reason) : o;
    return {
      ...base,
      razorpayPaymentId: o.razorpayPaymentId ?? paymentId,
      refund: { amount: o.total, razorpayRefundId: refundId, at: new Date().toISOString(), reason },
      notes: refundId ? o.notes : `${o.notes}${o.notes ? '\n' : ''}REFUND PENDING: Razorpay refund call failed; refund manually.`,
    };
  });
  if (refundId) await sendOrderEmailOnce(order.id, 'refunded');
  return { result, order: updated };
}

// ---- customer lookup (S7) -----------------------------------------------------

/** Month keys to search for an order number NWH-YYMMDD-XXXX (UTC date). */
export function indexMonthsForNumber(number: string): string[] {
  const m = /^NWH-(\d{2})(\d{2})(\d{2})-/.exec(number);
  if (!m) return [];
  const d = new Date(Date.UTC(2000 + Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return [ordersIndexKey(d)];
}

export async function findOrderByNumber(number: string, email: string): Promise<Order | null> {
  const norm = number.trim().toUpperCase();
  const mail = email.trim().toLowerCase();
  for (const key of indexMonthsForNumber(norm)) {
    const idx = await readJson(key, OrdersIndexDoc);
    const hit = idx?.orders.find((o) => o.number === norm);
    if (!hit) continue;
    const order = await readOrder(hit.id);
    if (order && order.email.toLowerCase() === mail) return order;
  }
  return null;
}

export function toPublicOrder(o: Order): PublicOrder {
  return {
    number: o.number,
    status: o.status,
    createdAt: o.createdAt,
    lines: o.lines.map((l) => ({ title: l.title, colour: l.colour, size: l.size, qty: l.qty, unitPrice: l.unitPrice, image: l.image })),
    subtotal: o.subtotal,
    discount: o.discount,
    shipping: o.shipping,
    total: o.total,
    couponCode: o.couponCode,
    shippingAddress: {
      name: o.shippingAddress.name,
      city: o.shippingAddress.city,
      state: o.shippingAddress.state,
      pincode: o.shippingAddress.pincode,
    },
    tracking: o.tracking,
    history: o.history.map((h) => ({ at: h.at, status: h.status })),
  };
}
