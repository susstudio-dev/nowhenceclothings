// /api/checkout core (C5, C6): recompute everything server-side, refuse on
// any stock/coupon problem, create the Razorpay order and persist ours.

import 'server-only';
import { newOrderNumber, type Order } from '@/lib/schemas/order';
import { loadQuoteContext, buildQuote, type QuoteContext } from './quote';
import { createRazorpayOrder, razorpayConfig, type RazorpayConfig } from './razorpay';
import { saveNewOrder } from './orders';
import type { CheckoutRequest, CheckoutResponse, QuoteResponse } from './types';

export class CheckoutError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly quote?: QuoteResponse,
  ) {
    super(message);
    this.name = 'CheckoutError';
  }
}

/** Builds the pending order from a validated request. Pure given ctx. */
export function buildPendingOrder(
  ctx: QuoteContext,
  req: CheckoutRequest,
  razorpayOrderId: string,
  ids: { id: string; number: string; now: Date },
): Order {
  const q = buildQuote({ ...ctx, now: ids.now }, req.lines, req.couponCode);
  const at = ids.now.toISOString();
  return {
    id: ids.id,
    number: ids.number,
    email: req.email,
    phone: req.phone,
    shippingAddress: req.address,
    lines: q.lines.map((l) => ({
      sku: l.sku,
      productId: l.productId,
      title: l.title,
      colour: l.colour,
      size: l.size as Order['lines'][number]['size'],
      qty: l.qty,
      unitPrice: l.unitPrice,
      ...(l.compareAtPrice != null ? { compareAtPrice: l.compareAtPrice } : {}),
      ...(l.image ? { image: l.image } : {}),
    })),
    subtotal: q.subtotal,
    discount: q.discount,
    shipping: q.shipping,
    total: q.total,
    ...(q.couponCode ? { couponCode: q.couponCode } : {}),
    status: 'pending_payment',
    razorpayOrderId,
    emailsSent: [],
    history: [{ at, status: 'pending_payment', by: 'customer' }],
    notes: '',
    createdAt: at,
    updatedAt: at,
  };
}

/** Validates the cart against live data; throws CheckoutError on any issue. */
export function assertCheckoutable(q: QuoteResponse, couponTyped: boolean): void {
  if (q.issues.length) throw new CheckoutError('Some items in your bag are no longer available.', 409, 'stock', q);
  if (couponTyped && q.couponError) throw new CheckoutError(q.couponError, 400, 'coupon', q);
  if (!q.lines.length || q.total <= 0) throw new CheckoutError('Your bag is empty.', 400, 'empty', q);
}

export async function placeOrder(
  req: CheckoutRequest,
  deps: { cfg?: RazorpayConfig | null; fetchImpl?: typeof fetch; ctx?: QuoteContext } = {},
): Promise<CheckoutResponse> {
  const cfg = deps.cfg === undefined ? razorpayConfig() : deps.cfg;
  if (!cfg) throw new CheckoutError('Payments are not configured.', 503, 'payments_unconfigured');
  const ctx = deps.ctx ?? (await loadQuoteContext());
  const now = new Date();
  const q = buildQuote({ ...ctx, now }, req.lines, req.couponCode);
  assertCheckoutable(q, Boolean(req.couponCode?.trim()));

  const id = crypto.randomUUID();
  const number = newOrderNumber(now);
  const rzp = await createRazorpayOrder(
    cfg,
    { amount: q.total, receipt: number, notes: { orderId: id, number } },
    deps.fetchImpl,
  );
  const order = buildPendingOrder(ctx, req, rzp.id, { id, number, now });
  if (order.total !== rzp.amount) throw new CheckoutError('Price changed, please retry.', 409, 'price_changed');
  await saveNewOrder(order);

  return {
    orderId: id,
    number,
    razorpay: {
      key: cfg.keyId,
      orderId: rzp.id,
      amount: order.total,
      currency: 'INR',
      name: ctx.settings.store.name,
      prefill: { name: req.address.name, email: req.email, contact: req.phone },
    },
  };
}
