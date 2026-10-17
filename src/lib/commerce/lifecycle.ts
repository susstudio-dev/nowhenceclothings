// Post-payment order lifecycle (QA F6/F8): expiry of unpaid orders, restock on
// admin cancel/refund, shipped/refunded emails, and the "commit stock" retry
// for orders left paid without stockCommittedAt.

import 'server-only';
import { getSettings } from '@/lib/content';
import { readJson } from '@/lib/storage';
import { INVENTORY_KEY } from '@/lib/schemas/inventory';
import { OrdersIndexDoc, ordersIndexKey, type Order, type OrderStatus, type OrderSummary } from '@/lib/schemas/order';
import { readOrder, sendOrderEmailOnce, updateOrder, withStatus } from './orders';
import { commitStock, OversellError, restockLines } from './stock';
import { releasePresaleUnits } from '@/lib/launches-server';
import { inventoryLines } from './order-lines';
import { ensureOrderCreditNote, quietly } from '@/lib/invoices/store';

/** A11: give back an order's presale units (cancel / refund / expiry). Never throws. */
export async function releaseOrderPresale(o: Pick<Order, 'id' | 'preorder' | 'lines'>): Promise<void> {
  if (!o.preorder) return;
  for (const pid of new Set(o.lines.map((l) => l.productId))) {
    try {
      await releasePresaleUnits(pid, o.id);
    } catch (err) {
      console.error('presale release failed', err instanceof Error ? err.message : '');
    }
  }
}

// ---- pure helpers -----------------------------------------------------------

/** True when an unpaid order is past its payment window. */
export function isPaymentExpired(
  o: Pick<Order, 'status' | 'createdAt'>,
  windowMinutes: number,
  now: Date = new Date(),
): boolean {
  if (o.status !== 'pending_payment') return false;
  return now.getTime() - new Date(o.createdAt).getTime() > windowMinutes * 60_000;
}

/** Statuses in which a paid order should hold committed stock. */
export const STOCK_HOLDING_STATUSES: readonly OrderStatus[] = ['paid', 'packed', 'shipped', 'delivered', 'exchange_requested'];

/** F8: paid (or later) and not refunded, but stock was never decremented. */
export function needsStockCommit(o: Pick<Order, 'status' | 'stockCommittedAt' | 'refund'>): boolean {
  return STOCK_HOLDING_STATUSES.includes(o.status) && !o.stockCommittedAt && !o.refund;
}

/**
 * Restock applies when an admin cancels/refunds an order whose goods never
 * left (paid or packed) and whose stock was committed.
 */
export function shouldRestock(before: Pick<Order, 'status'>, after: Pick<Order, 'status' | 'stockCommittedAt'>): boolean {
  return (
    (before.status === 'paid' || before.status === 'packed') &&
    (after.status === 'cancelled' || after.status === 'refunded') &&
    !!after.stockCommittedAt
  );
}

// ---- expiry -----------------------------------------------------------------

const EXPIRY_NOTE = 'Payment window expired';

/** Cancel one order if it is still pending past the window. Idempotent (CAS). */
export async function expireOrderIfStale(id: string, windowMinutes: number, now: Date = new Date()): Promise<Order | null> {
  const cur = await readOrder(id);
  if (!cur || !isPaymentExpired(cur, windowMinutes, now)) return cur;
  const { order } = await updateOrder(id, (o) =>
    isPaymentExpired(o, windowMinutes, now) ? withStatus(o, 'cancelled', 'system', EXPIRY_NOTE, now) : null,
  );
  if (order.status === 'cancelled') await releaseOrderPresale(order);
  return order;
}

async function paymentWindow(): Promise<number> {
  try {
    return (await getSettings()).orders.paymentWindowMinutes;
  } catch {
    return 30;
  }
}

/**
 * Lazy sweep: cancel stale pending_payment orders in this and last month's
 * index. Called from admin list/read, order tracking and the cron route.
 * Never throws; returns how many were cancelled.
 */
export async function expireStaleOrders(now: Date = new Date(), windowMinutes?: number): Promise<number> {
  try {
    const win = windowMinutes ?? (await paymentWindow());
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const keys = [...new Set([ordersIndexKey(now), ordersIndexKey(prev)])];
    const stale: OrderSummary[] = [];
    for (const key of keys) {
      const idx = await readJson(key, OrdersIndexDoc);
      for (const s of idx?.orders ?? []) if (isPaymentExpired(s, win, now)) stale.push(s);
    }
    let n = 0;
    for (const s of stale) {
      try {
        const o = await expireOrderIfStale(s.id, win, now);
        if (o?.status === 'cancelled') n++;
      } catch (err) {
        console.error('expire order failed', s.number, err instanceof Error ? err.message : '');
      }
    }
    return n;
  } catch (err) {
    console.error('expireStaleOrders', err instanceof Error ? err.message : '');
    return 0;
  }
}

// ---- restock ------------------------------------------------------------------

/**
 * Return a cancelled/refunded order's stock. Idempotent: the CAS that clears
 * `stockCommittedAt` elects exactly one caller to restock. Returns true when
 * this call restocked.
 */
export async function restockOrder(id: string, by: string, stockKey: string = INVENTORY_KEY): Promise<boolean> {
  let claimed: Order | null = null;
  await updateOrder(id, (o) => {
    claimed = null;
    if (!o.stockCommittedAt || (o.status !== 'cancelled' && o.status !== 'refunded')) return null;
    claimed = o;
    const at = new Date().toISOString();
    const rest = { ...o };
    delete rest.stockCommittedAt;
    return { ...rest, updatedAt: at, history: [...o.history, { at, status: o.status, by, note: 'Stock returned to inventory' }] };
  });
  const won = claimed as Order | null;
  if (!won) return false;
  await restockLines(
    inventoryLines(won),
    stockKey,
  );
  return true;
}

/**
 * Side effects after an admin status change: restock (paid/packed →
 * cancelled/refunded) and shipped/refunded customer emails. Never throws.
 */
export async function afterAdminStatusChange(
  before: Order,
  after: Order,
  by: string,
  opts: { stockKey?: string } = {},
): Promise<{ restocked: boolean; emailed: 'shipped' | 'refunded' | null }> {
  let restocked = false;
  let emailed: 'shipped' | 'refunded' | null = null;
  try {
    if (shouldRestock(before, after)) restocked = await restockOrder(after.id, by, opts.stockKey);
  } catch (err) {
    console.error('restock failed', after.number, err instanceof Error ? err.message : '');
  }
  if (before.status !== after.status && (after.status === 'cancelled' || after.status === 'refunded')) {
    await releaseOrderPresale(after);
  }
  if (before.status !== after.status && after.status === 'refunded' && after.invoice) {
    await quietly('credit note', () => ensureOrderCreditNote(after.id));
  }
  if (before.status !== after.status && (after.status === 'shipped' || after.status === 'refunded')) {
    if (await sendOrderEmailOnce(after.id, after.status)) emailed = after.status;
  }
  return { restocked, emailed };
}

// ---- F8 retry -------------------------------------------------------------------

export type CommitStockResult =
  | { result: 'committed'; order: Order }
  | { result: 'not_needed'; order: Order }
  | { result: 'oversell'; order: Order; detail: string }
  | { result: 'not_found' };

/**
 * Admin retry for an order left paid without stockCommittedAt. Claims by
 * setting stockCommittedAt first (CAS, so two clicks commit once), then
 * decrements; on failure the claim is rolled back.
 */
export async function retryCommitStock(id: string, by: string, stockKey: string = INVENTORY_KEY): Promise<CommitStockResult> {
  const cur = await readOrder(id);
  if (!cur) return { result: 'not_found' };
  let won = false;
  const claimAt = new Date().toISOString();
  const { order: claimed } = await updateOrder(id, (o) => {
    won = needsStockCommit(o);
    return won ? { ...o, stockCommittedAt: claimAt } : null;
  });
  if (!won) return { result: 'not_needed', order: claimed };

  const rollback = () =>
    updateOrder(id, (o) => {
      if (o.stockCommittedAt !== claimAt) return null;
      const rest = { ...o };
      delete rest.stockCommittedAt;
      return rest;
    });
  try {
    await commitStock(
      inventoryLines(claimed),
      stockKey,
    );
  } catch (err) {
    await rollback();
    if (err instanceof OversellError) {
      return { result: 'oversell', order: (await readOrder(id)) ?? claimed, detail: err.message };
    }
    throw err;
  }
  const { order } = await updateOrder(id, (o) => ({
    ...o,
    updatedAt: claimAt,
    history: [...o.history, { at: claimAt, status: o.status, by, note: 'Stock committed (retry)' }],
  }));
  return { result: 'committed', order };
}

/** Lazy single-order expiry using the configured window. Never throws. */
export async function expireIfStale(id: string, now: Date = new Date()): Promise<void> {
  try {
    await expireOrderIfStale(id, await paymentWindow(), now);
  } catch (err) {
    console.error('expireIfStale', id, err instanceof Error ? err.message : '');
  }
}
