import 'server-only';
// Server-side admin data operations. Every shared-document write goes
// through writeJsonCas with a pure mutator from the sibling modules.
import { listKeys, readJson, snapshotVersion, writeJsonCas } from '@/lib/storage';
import { getSiteContent } from '@/lib/content';
import { Order, OrdersIndexDoc, orderKey, ordersIndexKey, summarize, type OrderSummary } from '@/lib/schemas/order';
import { SITE_CONTENT_DRAFT_KEY, SITE_CONTENT_KEY, SiteContentDoc } from '@/lib/schemas/site-content';
import { applyOrderPatch, upsertSummary, type OrderPatch } from './orders';
import { NotFoundError } from './catalogue-mutations';
import { CONTENT_VERSION_DOC, CONTENT_VERSIONS_PREFIX, isContentVersionKey, versionTime } from './content';
import { HttpError } from './api';

// ---- orders (A4) -----------------------------------------------------------

/** Summaries from the newest `months` index docs, newest first. */
export async function listOrderSummaries(months = 12): Promise<OrderSummary[]> {
  const keys = (await listKeys('orders-index/')).map((k) => k.key).sort().reverse().slice(0, months);
  const out: OrderSummary[] = [];
  for (const key of keys) {
    const doc = await readJson(key, OrdersIndexDoc);
    if (doc) out.push(...doc.orders);
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getOrder(id: string): Promise<Order | null> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  return readJson(orderKey(id), Order);
}

/** CAS-patch one order, then refresh its summary in the monthly index. */
export async function patchOrder(id: string, patch: OrderPatch, by: string): Promise<Order> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new NotFoundError(`Order ${id}`);
  const order = await writeJsonCas(orderKey(id), Order, (cur) => {
    if (!cur) throw new NotFoundError(`Order ${id}`);
    return applyOrderPatch(cur, patch, by);
  });
  await writeJsonCas(
    ordersIndexKey(order.createdAt),
    OrdersIndexDoc,
    (cur) => ({ orders: upsertSummary(cur?.orders ?? [], summarize(order)) }),
    { initial: () => ({ orders: [] }) },
  );
  return order;
}

/** Full orders for CSV export (bounded). */
export async function loadOrders(ids: string[], limit = 2000): Promise<Order[]> {
  const out: Order[] = [];
  for (const id of ids.slice(0, limit)) {
    const o = await getOrder(id);
    if (o) out.push(o);
  }
  return out;
}

// ---- content (A6): draft -> preview -> publish, version history ------------

export async function readDraft(): Promise<SiteContentDoc> {
  return getSiteContent({ draft: true });
}

export async function saveDraft(doc: SiteContentDoc, by: string): Promise<SiteContentDoc> {
  const stamped = { ...doc, updatedAt: new Date().toISOString(), updatedBy: by };
  return writeJsonCas(SITE_CONTENT_DRAFT_KEY, SiteContentDoc, () => stamped);
}

/** Snapshot the live doc, then copy the draft over it. */
export async function publishDraft(by: string): Promise<{ published: SiteContentDoc; snapshot: string | null }> {
  const draft = await readJson(SITE_CONTENT_DRAFT_KEY, SiteContentDoc);
  if (!draft) throw new HttpError(400, 'There is no draft to publish');
  const live = await readJson(SITE_CONTENT_KEY, SiteContentDoc);
  const snapshot = live ? await snapshotVersion(CONTENT_VERSION_DOC, live) : null;
  const next = { ...draft, updatedAt: new Date().toISOString(), updatedBy: by };
  const published = await writeJsonCas(SITE_CONTENT_KEY, SiteContentDoc, () => next);
  return { published, snapshot };
}

export interface ContentVersion {
  key: string;
  at: string;
}

export async function listContentVersions(limit = 50): Promise<ContentVersion[]> {
  return (await listKeys(CONTENT_VERSIONS_PREFIX))
    .map((k) => k.key)
    .filter(isContentVersionKey)
    .sort()
    .reverse()
    .slice(0, limit)
    .map((key) => ({ key, at: versionTime(key) }));
}

/** Load a snapshot into the DRAFT (publish is a separate, deliberate step). */
export async function restoreVersionToDraft(key: string, by: string): Promise<SiteContentDoc> {
  if (!isContentVersionKey(key)) throw new HttpError(400, 'Not a content version');
  const snap = await readJson(key, SiteContentDoc);
  if (!snap) throw new NotFoundError('Version');
  return saveDraft(snap, by);
}
