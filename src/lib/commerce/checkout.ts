// /api/checkout core (C5, C6): recompute everything server-side, refuse on
// any stock/coupon problem, create the Razorpay order and persist ours.

import 'server-only';
import { newOrderNumber, type Order } from '@/lib/schemas/order';
import { loadQuoteContext, buildQuote, type QuoteContext } from './quote';
import { createRazorpayOrder, razorpayConfig, type RazorpayConfig } from './razorpay';
import { saveNewOrder } from './orders';
import type { CheckoutRequest, CheckoutResponse, QuoteResponse } from './types';
import { MIXED_CART_MESSAGE, PresaleRuleError, assertPresaleAccess, resolveLaunch } from '@/lib/launches';
import { releasePresaleUnits, reservePresaleUnits, waitlistEmails } from '@/lib/launches-server';
import type { Product } from '@/lib/schemas/catalogue';

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
    ...(q.preorder ? { preorder: true, ...(q.preorder.shipBy ? { shipBy: q.preorder.shipBy } : {}) } : {}),
    createdAt: at,
    updatedAt: at,
  };
}

/** Validates the cart against live data; throws CheckoutError on any issue. */
export function assertCheckoutable(q: QuoteResponse, couponTyped: boolean): void {
  if (q.mixedPresale) throw new CheckoutError(MIXED_CART_MESSAGE, 409, 'mixed_cart', q);
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
  const release = await presaleGate(ctx, req, q, id, now);
  let order: Order;
  let rzp: Awaited<ReturnType<typeof createRazorpayOrder>>;
  try {
    rzp = await createRazorpayOrder(
      cfg,
      { amount: q.total, receipt: number, notes: { orderId: id, number } },
      deps.fetchImpl,
    );
    order = buildPendingOrder(ctx, req, rzp.id, { id, number, now });
    if (order.total !== rzp.amount) throw new CheckoutError('Price changed, please retry.', 409, 'price_changed');
    await saveNewOrder(order);
  } catch (err) {
    await release().catch(() => undefined);
    throw err;
  }

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

export interface PresaleGateDeps {
  waitlist?: (product: Product) => Promise<string[]>;
  reserve?: typeof reservePresaleUnits;
  release?: typeof releasePresaleUnits;
}

/**
 * A11 server-side presale rules for a quoted cart: access gate (code or
 * waitlist), then cap + per-customer limit reserved via writeJsonCas on
 * presale/{productId}.json. Returns a function that undoes the reservations.
 */
export async function presaleGate(
  ctx: QuoteContext,
  req: Pick<CheckoutRequest, 'email' | 'presaleAccessCode'>,
  q: QuoteResponse,
  orderId: string,
  now: Date,
  deps: PresaleGateDeps = {},
): Promise<() => Promise<void>> {
  const waitlist = deps.waitlist ?? waitlistEmails;
  const reserve = deps.reserve ?? reservePresaleUnits;
  const releaseFn = deps.release ?? releasePresaleUnits;
  const qtyByProduct = new Map<string, number>();
  for (const l of q.lines) if (l.preorder) qtyByProduct.set(l.productId, (qtyByProduct.get(l.productId) ?? 0) + l.qty);
  const done: string[] = [];
  const undo = async () => {
    for (const pid of done) await releaseFn(pid, orderId);
  };
  try {
    for (const [productId, qty] of qtyByProduct) {
      const product = ctx.catalogue.products.find((p) => p.id === productId);
      if (!product) continue;
      const r = resolveLaunch(product, ctx.catalogue.drops, ctx.settings.launches, now);
      if (r.state !== 'presale' || !r.presale) throw new CheckoutError('Pre-orders for this piece have closed.', 409, 'presale_closed', q);
      const pre = r.presale;
      assertPresaleAccess(pre, {
        code: req.presaleAccessCode,
        email: req.email,
        waitlist: pre.access === 'waitlist' ? await waitlist(product) : [],
      });
      await reserve(productId, {
        orderId,
        email: req.email,
        qty,
        cap: pre.cap,
        perCustomerLimit: pre.perCustomerLimit,
        at: now.toISOString(),
      });
      done.push(productId);
    }
  } catch (err) {
    await undo().catch(() => undefined);
    if (err instanceof PresaleRuleError) throw new CheckoutError(err.message, err.code === 'presale_access' ? 403 : 409, err.code, q);
    throw err;
  }
  return undo;
}
