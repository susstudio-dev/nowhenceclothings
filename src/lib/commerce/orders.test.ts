import { promises as fs } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { deleteKey, readJson, writeJsonCas } from '@/lib/storage';
import { InventoryDoc } from '@/lib/schemas/inventory';
import { Order, OrdersIndexDoc, orderKey, ordersIndexKey } from '@/lib/schemas/order';
import { assertCheckoutable, CheckoutError, placeOrder } from './checkout';
import { confirmPayment, findOrderByNumber, indexMonthsForNumber, razorpayMapKey, readOrder, toPublicOrder, withStatus } from './orders';
import { buildQuote, loadQuoteContext, normaliseLines, type QuoteContext } from './quote';
import type { CheckoutRequest } from './types';

// Integration test on the dev filesystem backend (data/). Uses the seed
// catalogue/settings, a scratch inventory key, and cleans up every order key.
const STOCK_KEY = '__test__/orders-inventory.json';
const cfg = { keyId: 'rzp_test_x', keySecret: 'sec', webhookSecret: 'wh' };
const created: { id: string; rzp: string; createdAt: string }[] = [];
let ctx: QuoteContext;
let sku: string;
let sku2: string;
let rzpSeq = 0;

function fakeFetch(amountRef: { amount?: number } = {}) {
  return vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as { amount: number };
    amountRef.amount = body.amount;
    return new Response(JSON.stringify({ id: `order_T${Date.now()}${rzpSeq++}`, amount: body.amount, currency: 'INR', status: 'created' }));
  }) as unknown as typeof fetch;
}

function req(lines: { sku: string; qty: number }[], couponCode?: string): CheckoutRequest {
  return {
    lines,
    couponCode,
    email: 'Buyer@Example.com',
    phone: '9876543210',
    address: { name: 'Test Buyer', line1: '1 Road', line2: '', city: 'Pune', state: 'Maharashtra', pincode: '411001', country: 'IN' },
  };
}

async function place(lines: { sku: string; qty: number }[]) {
  const res = await placeOrder(req(lines), { cfg, fetchImpl: fakeFetch(), ctx });
  const o = (await readOrder(res.orderId))!;
  created.push({ id: o.id, rzp: o.razorpayOrderId, createdAt: o.createdAt });
  return o;
}

beforeAll(async () => {
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
  delete process.env.RESEND_API_KEY;
  const live = await loadQuoteContext();
  const released = live.catalogue.products.filter((p) => p.status === 'active' && !p.dropId);
  sku = released[0]!.variants[0]!.sku;
  sku2 = released[1]!.variants[0]!.sku;
  const level = { stock: 5, reserved: 0, lowStockAt: 1 };
  ctx = { ...live, inventory: { [sku]: level, [sku2]: level }, coupons: live.coupons };
  await writeJsonCas(STOCK_KEY, InventoryDoc, () => ({ [sku]: { ...level, stock: 2 }, [sku2]: { ...level, stock: 0 } }), {
    initial: () => ({}),
  });
});

afterAll(async () => {
  const meta = path.join(process.env.NOWHENCE_DATA_DIR ?? path.join(process.cwd(), 'data'), '.meta');
  const months = new Set<string>();
  for (const c of created) {
    await deleteKey(orderKey(c.id));
    await deleteKey(razorpayMapKey(c.rzp));
    await fs.rm(path.join(meta, `orders__${c.id}.json.json`), { force: true });
    months.add(ordersIndexKey(c.createdAt));
  }
  const ids = new Set(created.map((c) => c.id));
  for (const key of months) {
    const idx = await writeJsonCas(key, OrdersIndexDoc, (cur) => ({ orders: (cur?.orders ?? []).filter((o) => !ids.has(o.id)) }));
    if (!idx.orders.length) {
      await deleteKey(key);
      await fs.rm(path.join(meta, `${key.replace(/\//g, '__')}.json`), { force: true });
    }
  }
  await deleteKey(STOCK_KEY);
  await fs.rm(path.join(meta, '__test____orders-inventory.json.json'), { force: true });
});

describe('quote', () => {
  it('merges duplicate lines and clamps qty', () => {
    expect(normaliseLines([{ sku: 'A', qty: 6 }, { sku: 'A', qty: 6 }], 10)).toEqual([{ sku: 'A', qty: 10 }]);
  });
  it('prices server-side and flags problems', () => {
    const q = buildQuote(ctx, [{ sku, qty: 1 }, { sku: 'NOPE-1', qty: 1 }, { sku: sku2, qty: 9 }]);
    expect(q.lines.map((l) => l.sku)).toEqual([sku, sku2]);
    expect(q.issues).toEqual([
      { sku: 'NOPE-1', issue: 'unknown' },
      { sku: sku2, issue: 'insufficient_stock', available: 5 },
    ]);
    expect(q.total).toBe(q.subtotal - q.discount + q.shipping);
    expect(() => assertCheckoutable(q, false)).toThrow(CheckoutError);
  });
  it('blocks unreleased drops', () => {
    const drop = ctx.catalogue.products.find((p) => p.dropId)!;
    const s = drop.variants[0]!.sku;
    const q = buildQuote({ ...ctx, now: new Date('2026-01-01'), inventory: { [s]: { stock: 5, reserved: 0, lowStockAt: 1 } } }, [{ sku: s, qty: 1 }]);
    expect(q.issues[0]?.issue).toBe('not_released');
  });
  it('rejects an invalid coupon at checkout', () => {
    const q = buildQuote(ctx, [{ sku, qty: 1 }], 'NOPE');
    expect(() => assertCheckoutable(q, true)).toThrow(/does not exist/);
  });
});

describe('order lifecycle', () => {
  it('refuses checkout when payments are unconfigured', async () => {
    await expect(placeOrder(req([{ sku, qty: 1 }]), { cfg: null, ctx })).rejects.toMatchObject({ status: 503 });
  });

  it('creates a pending order with server-computed totals', async () => {
    const ref: { amount?: number } = {};
    const res = await placeOrder(req([{ sku, qty: 2 }]), { cfg, fetchImpl: fakeFetch(ref), ctx });
    const o = (await readOrder(res.orderId))!;
    created.push({ id: o.id, rzp: o.razorpayOrderId, createdAt: o.createdAt });
    expect(Order.parse(o).status).toBe('pending_payment');
    expect(o.email).toBe('buyer@example.com');
    expect(ref.amount).toBe(o.total);
    expect(res.razorpay).toMatchObject({ key: 'rzp_test_x', orderId: o.razorpayOrderId, amount: o.total, currency: 'INR' });
    const idx = await readJson(ordersIndexKey(o.createdAt), OrdersIndexDoc);
    expect(idx?.orders.some((s) => s.id === o.id)).toBe(true);
  });

  it('confirms once even when callback and webhook race', async () => {
    const o = await place([{ sku, qty: 2 }]);
    const [a, b] = await Promise.all([
      confirmPayment({ razorpayOrderId: o.razorpayOrderId, razorpayPaymentId: 'pay_1', by: 'customer', stockKey: STOCK_KEY }),
      confirmPayment({ razorpayOrderId: o.razorpayOrderId, razorpayPaymentId: 'pay_1', amount: o.total, by: 'webhook', stockKey: STOCK_KEY }),
    ]);
    expect([a.result, b.result].sort()).toEqual(['applied', 'duplicate']);
    const after = (await readOrder(o.id))!;
    expect(after.status).toBe('paid');
    expect(after.stockCommittedAt).toBeDefined();
    expect(after.razorpayPaymentId).toBe('pay_1');
    expect((await readJson(STOCK_KEY, InventoryDoc))![sku]!.stock).toBe(0);
    const again = await confirmPayment({ razorpayOrderId: o.razorpayOrderId, razorpayPaymentId: 'pay_1', by: 'webhook', stockKey: STOCK_KEY });
    expect(again.result).toBe('duplicate');
  });

  it('refunds on oversell', async () => {
    const o = await place([{ sku, qty: 1 }]);
    const res = await confirmPayment({ razorpayOrderId: o.razorpayOrderId, razorpayPaymentId: 'pay_2', by: 'webhook', stockKey: STOCK_KEY });
    expect(res.result).toBe('oversell_refunded');
    const after = (await readOrder(o.id))!;
    expect(after.status).toBe('refunded');
    expect(after.refund?.amount).toBe(o.total);
    expect(after.notes).toMatch(/REFUND PENDING/); // no Razorpay keys in tests
    expect(after.stockCommittedAt).toBeUndefined();
  });

  it('rejects amount mismatches and unknown orders', async () => {
    const o = await place([{ sku: sku2, qty: 1 }]);
    expect((await confirmPayment({ razorpayOrderId: o.razorpayOrderId, razorpayPaymentId: 'p', amount: 1, by: 'webhook', stockKey: STOCK_KEY })).result).toBe('amount_mismatch');
    expect((await readOrder(o.id))!.status).toBe('pending_payment');
    expect((await confirmPayment({ razorpayOrderId: 'order_missing', razorpayPaymentId: 'p', by: 'webhook' })).result).toBe('not_found');
  });

  it('looks orders up by number + email only', async () => {
    const o = (await readOrder(created[0]!.id))!;
    expect(indexMonthsForNumber(o.number)).toEqual([ordersIndexKey(o.createdAt)]);
    expect((await findOrderByNumber(o.number.toLowerCase(), 'BUYER@example.com'))?.id).toBe(o.id);
    expect(await findOrderByNumber(o.number, 'someone@else.com')).toBeNull();
    expect(await findOrderByNumber('NWH-000000-XXXX', 'buyer@example.com')).toBeNull();
    const pub = toPublicOrder(o);
    expect(pub).not.toHaveProperty('email');
    expect(pub).not.toHaveProperty('notes');
  });

  it('withStatus enforces the state machine', () => {
    const o = { status: 'pending_payment', history: [], updatedAt: '' } as unknown as Order;
    expect(withStatus(o, 'paid', 'x').status).toBe('paid');
    expect(() => withStatus(o, 'shipped', 'x')).toThrow(/illegal/);
  });
});
