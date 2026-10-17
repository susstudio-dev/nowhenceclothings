import { promises as fs } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createJson, deleteKey, readJson, writeJsonCas } from '@/lib/storage';
import { InventoryDoc } from '@/lib/schemas/inventory';
import { Order, OrdersIndexDoc, orderKey, ordersIndexKey } from '@/lib/schemas/order';
import { applyStockIncrement } from './stock-core';
import { timingSafeEqualStr } from './lifecycle-auth';
import {
  afterAdminStatusChange,
  expireOrderIfStale,
  expireStaleOrders,
  isPaymentExpired,
  needsStockCommit,
  restockOrder,
  retryCommitStock,
  shouldRestock,
} from './lifecycle';
import { readOrder, syncOrderIndex } from './orders';

// Integration on the dev filesystem backend with scratch keys.
const STOCK_KEY = '__test__/lifecycle-inventory.json';
const ids: string[] = [];
const months = new Set<string>();
let seq = 0;

async function mk(over: Partial<Order> = {}): Promise<Order> {
  const createdAt = over.createdAt ?? new Date().toISOString();
  seq++;
  const id = `lc-test-${Date.now().toString(36)}-${seq}`;
  const ymd = `${createdAt.slice(2, 4)}${createdAt.slice(5, 7)}${createdAt.slice(8, 10)}`;
  const o = Order.parse({
    id,
    number: `NWH-${ymd}-Z${String(seq).padStart(3, '0')}`,
    email: 'a@b.in',
    phone: '9876543210',
    shippingAddress: { name: 'A', line1: '1 Road', city: 'Pune', state: 'MH', pincode: '411001' },
    lines: [{ sku: 'LC-SKU', productId: 'p1', title: 'Tee', colour: 'Bone', size: 'M', qty: 2, unitPrice: 1000 }],
    subtotal: 2000,
    discount: 0,
    shipping: 0,
    total: 2000,
    status: 'paid',
    razorpayOrderId: `order_lc${seq}`,
    history: [{ at: createdAt, status: over.status ?? 'paid', by: 'webhook' }],
    createdAt,
    updatedAt: createdAt,
    ...over,
  });
  await createJson(orderKey(id), Order, o);
  await syncOrderIndex(o);
  ids.push(id);
  months.add(ordersIndexKey(createdAt));
  return o;
}

const setStock = (n: number) =>
  writeJsonCas(STOCK_KEY, InventoryDoc, () => ({ 'LC-SKU': { stock: n, reserved: 0, lowStockAt: 1 } }), {
    initial: () => ({}),
  });
const stock = async () => (await readJson(STOCK_KEY, InventoryDoc))?.['LC-SKU']?.stock;

afterAll(async () => {
  for (const id of ids) {
    await deleteKey(orderKey(id));
    await fs.rm(path.join(process.env.NOWHENCE_DATA_DIR ?? path.join(process.cwd(), 'data'), '.meta', `orders__${id}.json.json`), { force: true });
  }
  for (const key of months) {
    await writeJsonCas(
      key,
      OrdersIndexDoc,
      (cur) => ({ orders: (cur?.orders ?? []).filter((o) => !ids.includes(o.id)) }),
      { initial: () => ({ orders: [] }) },
    );
  }
  await deleteKey(STOCK_KEY);
});

describe('pure helpers', () => {
  const now = new Date('2026-10-17T12:00:00Z');
  it('isPaymentExpired only for pending orders past the window', () => {
    expect(isPaymentExpired({ status: 'pending_payment', createdAt: '2026-10-17T11:29:00Z' }, 30, now)).toBe(true);
    expect(isPaymentExpired({ status: 'pending_payment', createdAt: '2026-10-17T11:31:00Z' }, 30, now)).toBe(false);
    expect(isPaymentExpired({ status: 'paid', createdAt: '2026-10-01T00:00:00Z' }, 30, now)).toBe(false);
  });
  it('needsStockCommit flags paid-or-later orders without stockCommittedAt', () => {
    expect(needsStockCommit({ status: 'paid' })).toBe(true);
    expect(needsStockCommit({ status: 'shipped' })).toBe(true);
    expect(needsStockCommit({ status: 'paid', stockCommittedAt: '2026-10-17T00:00:00Z' })).toBe(false);
    expect(needsStockCommit({ status: 'pending_payment' })).toBe(false);
    expect(needsStockCommit({ status: 'refunded' })).toBe(false);
    expect(needsStockCommit({ status: 'paid', refund: { amount: 1, at: '2026-10-17T00:00:00Z', reason: '' } })).toBe(false);
  });
  it('shouldRestock only for paid/packed to cancelled/refunded with committed stock', () => {
    const c = '2026-10-17T00:00:00Z';
    expect(shouldRestock({ status: 'paid' }, { status: 'cancelled', stockCommittedAt: c })).toBe(true);
    expect(shouldRestock({ status: 'packed' }, { status: 'refunded', stockCommittedAt: c })).toBe(true);
    expect(shouldRestock({ status: 'shipped' }, { status: 'refunded', stockCommittedAt: c })).toBe(false);
    expect(shouldRestock({ status: 'paid' }, { status: 'cancelled' })).toBe(false);
  });
  it('applyStockIncrement adds back and recreates missing SKUs', () => {
    const inv = applyStockIncrement({ A: { stock: 1, reserved: 0, lowStockAt: 3 } }, [
      { sku: 'A', qty: 2 },
      { sku: 'B', qty: 1 },
    ]);
    expect(inv.A!.stock).toBe(3);
    expect(inv.B!.stock).toBe(1);
  });
  it('timingSafeEqualStr', () => {
    expect(timingSafeEqualStr('abc', 'abc')).toBe(true);
    expect(timingSafeEqualStr('abc', 'abd')).toBe(false);
    expect(timingSafeEqualStr('abc', 'ab')).toBe(false);
  });
});

describe('expiry (F6)', () => {
  it('cancels a stale pending order once and leaves fresh ones', async () => {
    const old = new Date(Date.now() - 2 * 3600_000).toISOString();
    const stale = await mk({ status: 'pending_payment', createdAt: old });
    const fresh = await mk({ status: 'pending_payment' });
    const n = await expireStaleOrders(new Date(), 30);
    expect(n).toBeGreaterThanOrEqual(1);
    const s = (await readOrder(stale.id))!;
    expect(s.status).toBe('cancelled');
    expect(s.history.at(-1)).toMatchObject({ status: 'cancelled', by: 'system' });
    expect((await readOrder(fresh.id))!.status).toBe('pending_payment');
    const again = await expireOrderIfStale(stale.id, 30);
    expect(again!.history.filter((h) => h.status === 'cancelled')).toHaveLength(1);
  });
});

describe('restock (F6)', () => {
  it('restocks once on admin cancel of a paid order', async () => {
    await setStock(5);
    const before = await mk({ status: 'paid', stockCommittedAt: new Date().toISOString() });
    const after = Order.parse({ ...before, status: 'cancelled' });
    await writeJsonCas(orderKey(before.id), Order, () => after);
    const res = await afterAdminStatusChange(before, after, 'admin@x', { stockKey: STOCK_KEY });
    expect(res.restocked).toBe(true);
    expect(await stock()).toBe(7);
    expect(await restockOrder(before.id, 'admin@x', STOCK_KEY)).toBe(false);
    expect(await stock()).toBe(7);
    expect((await readOrder(before.id))!.stockCommittedAt).toBeUndefined();
  });
  it('does not restock shipped orders and skips email without a key', async () => {
    delete process.env.RESEND_API_KEY;
    await setStock(5);
    const before = await mk({ status: 'shipped', stockCommittedAt: new Date().toISOString() });
    const after = Order.parse({ ...before, status: 'refunded' });
    await writeJsonCas(orderKey(before.id), Order, () => after);
    const res = await afterAdminStatusChange(before, after, 'admin@x', { stockKey: STOCK_KEY });
    expect(res).toEqual({ restocked: false, emailed: null });
    expect(await stock()).toBe(5);
  });
});

describe('commit-stock retry (F8)', () => {
  it('commits once, then reports not_needed', async () => {
    await setStock(5);
    const o = await mk({ status: 'paid' });
    expect((await retryCommitStock(o.id, 'admin@x', STOCK_KEY)).result).toBe('committed');
    expect(await stock()).toBe(3);
    expect((await retryCommitStock(o.id, 'admin@x', STOCK_KEY)).result).toBe('not_needed');
    expect(await stock()).toBe(3);
  });
  it('rolls back the claim on oversell', async () => {
    await setStock(1);
    const o = await mk({ status: 'packed' });
    expect((await retryCommitStock(o.id, 'admin@x', STOCK_KEY)).result).toBe('oversell');
    expect((await readOrder(o.id))!.stockCommittedAt).toBeUndefined();
    expect(await stock()).toBe(1);
  });
  it('not_found for a missing order', async () => {
    expect((await retryCommitStock('lc-missing-zzz', 'a', STOCK_KEY)).result).toBe('not_found');
  });
});
