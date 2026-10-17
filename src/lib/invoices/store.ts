// A14: issue + read GST documents on R2. Every issue is idempotent: the CAS
// counter remembers which source got which number (no gaps under races) and
// the source doc (order / booking) records the reference once written.

import 'server-only';
import { getSettings } from '@/lib/content';
import { getCatalogue } from '@/lib/catalogue';
import { createJson, listKeys, readJson, readText, writeJsonCas, writeText } from '@/lib/storage';
import { Order, orderKey } from '@/lib/schemas/order';
import { Booking, bookingKey } from '@/lib/schemas/bookings';
import {
  InvoiceCounterDoc,
  InvoiceDoc,
  invoiceCounterKey,
  invoiceDocKey,
  invoicePdfKey,
  type InvoiceKind,
} from '@/lib/schemas/invoices';
import type { SettingsDoc } from '@/lib/schemas/settings';
import { buildBookingReceipt, buildCreditNote, buildOrderInvoice, invoiceNumber, type Numbered } from './compute';
import { financialYear } from './gst';
import { renderInvoicePdf } from './pdf';

export interface InvoiceDeps {
  settings?: SettingsDoc;
  now?: Date;
  hsnFor?: (productId: string) => string | undefined;
  /** Test seam: key prefix for counters/docs isolation is via settings.tax.invoicePrefix. */
  skipPdf?: boolean;
}

const PAID_STATUSES = new Set(['paid', 'packed', 'shipped', 'delivered', 'exchange_requested', 'refunded']);

/**
 * Allocate (or recall) the number for `kind` + `sourceId` in a financial year.
 * Concurrent callers for the same source get the same number; different
 * sources get consecutive numbers with no gaps.
 */
export async function allocateNumber(kind: InvoiceKind, fy: string, sourceId: string, prefix: string): Promise<{ number: string; seq: number }> {
  const tag = `${kind}:${sourceId}`;
  const doc = await writeJsonCas(
    invoiceCounterKey(fy),
    InvoiceCounterDoc,
    (cur) => {
      const c = cur ?? { fy, invoice: 0, receipt: 0, credit_note: 0, assigned: {} };
      if (c.assigned[tag]) return c;
      const seq = c[kind] + 1;
      return { ...c, [kind]: seq, assigned: { ...c.assigned, [tag]: invoiceNumber(prefix, kind, fy, seq) } };
    },
    { retries: 12 },
  );
  const number = doc.assigned[tag]!;
  return { number, seq: Number(number.split('/').pop()) };
}

async function hsnLookup(): Promise<(id: string) => string | undefined> {
  try {
    const cat = await getCatalogue();
    const m = new Map(cat.products.map((p) => [p.id, p.hsn]));
    return (id) => m.get(id) ?? undefined;
  } catch {
    return () => undefined;
  }
}

async function persist(doc: InvoiceDoc, skipPdf?: boolean): Promise<InvoiceDoc> {
  const key = invoiceDocKey(doc.fy, doc.number);
  if (!(await createJson(key, InvoiceDoc, doc))) {
    // Another caller wrote it first: theirs is canonical.
    return (await readJson(key, InvoiceDoc)) ?? doc;
  }
  if (!skipPdf) {
    try {
      const bytes = await renderInvoicePdf(doc);
      await writeText(invoicePdfKey(doc.fy, doc.number), Buffer.from(bytes).toString('base64'));
    } catch (err) {
      console.error('invoice pdf store failed (rendered on demand)', doc.number, err instanceof Error ? err.message : '');
    }
  }
  return doc;
}

const refOf = (d: InvoiceDoc) => ({ number: d.number, fy: d.fy, issuedAt: d.issuedAt });

export async function readInvoice(fy: string, number: string): Promise<InvoiceDoc | null> {
  return readJson(invoiceDocKey(fy, number), InvoiceDoc);
}

/** Tax invoice for a paid order. Idempotent; never issued for unpaid orders. */
export async function ensureOrderInvoice(orderId: string, deps: InvoiceDeps = {}): Promise<InvoiceDoc | null> {
  const order = await readJson(orderKey(orderId), Order);
  if (!order || !order.razorpayPaymentId || !PAID_STATUSES.has(order.status)) return null;
  if (order.invoice) return readInvoice(order.invoice.fy, order.invoice.number);
  const settings = deps.settings ?? (await getSettings());
  const paidAt = order.history.find((h) => h.status === 'paid')?.at ?? order.updatedAt;
  const fy = financialYear(paidAt);
  const { number, seq } = await allocateNumber('invoice', fy, order.id, settings.tax.invoicePrefix);
  let receipt: string | undefined;
  if (order.bookingId) {
    const b = await readJson(bookingKey(order.bookingId), Booking);
    receipt = b?.receipt?.number;
  }
  const n: Numbered = { number, seq, fy, issuedAt: (deps.now ?? new Date(paidAt)).toISOString() };
  const doc = await persist(buildOrderInvoice(order, settings, deps.hsnFor ?? (await hsnLookup()), n, receipt), deps.skipPdf);
  await writeJsonCas(orderKey(orderId), Order, (o) => {
    if (!o) throw new Error('order missing');
    return o.invoice ? o : { ...o, invoice: refOf(doc) };
  });
  return doc;
}

/** Receipt voucher for a paid booking deposit. Idempotent. */
export async function ensureBookingReceipt(bookingId: string, deps: InvoiceDeps = {}): Promise<InvoiceDoc | null> {
  const b = await readJson(bookingKey(bookingId), Booking);
  if (!b || !b.depositPaymentId) return null;
  if (b.receipt) return readInvoice(b.receipt.fy, b.receipt.number);
  const settings = deps.settings ?? (await getSettings());
  const paidAt = b.history.find((h) => h.status === 'deposit_paid')?.at ?? b.updatedAt;
  const fy = financialYear(paidAt);
  const { number, seq } = await allocateNumber('receipt', fy, b.id, settings.tax.invoicePrefix);
  const doc = await persist(buildBookingReceipt(b, settings, { number, seq, fy, issuedAt: (deps.now ?? new Date(paidAt)).toISOString() }), deps.skipPdf);
  await writeJsonCas(bookingKey(bookingId), Booking, (x) => {
    if (!x) throw new Error('booking missing');
    return x.receipt ? x : { ...x, receipt: refOf(doc) };
  });
  return doc;
}

/** Credit note for a refunded order (needs an invoice; issues one first if missing). */
export async function ensureOrderCreditNote(orderId: string, deps: InvoiceDeps = {}): Promise<InvoiceDoc | null> {
  const order = await readJson(orderKey(orderId), Order);
  if (!order || (!order.refund && order.status !== 'refunded')) return null;
  const refund = order.refund ?? { amount: order.total, at: order.updatedAt, reason: '' };
  if (order.creditNote) return readInvoice(order.creditNote.fy, order.creditNote.number);
  const inv = await ensureOrderInvoice(orderId, deps);
  if (!inv) return null;
  const settings = deps.settings ?? (await getSettings());
  const at = deps.now ?? new Date(refund.at);
  const fy = financialYear(at);
  const { number, seq } = await allocateNumber('credit_note', fy, order.id, settings.tax.invoicePrefix);
  const doc = await persist(buildCreditNote(inv, refund.amount, { number, seq, fy, issuedAt: at.toISOString() }, refund.reason), deps.skipPdf);
  await writeJsonCas(orderKey(orderId), Order, (o) => {
    if (!o) throw new Error('order missing');
    return o.creditNote ? o : { ...o, creditNote: refOf(doc) };
  });
  return doc;
}

/** Credit note for a refunded booking deposit. */
export async function ensureBookingCreditNote(bookingId: string, deps: InvoiceDeps = {}): Promise<InvoiceDoc | null> {
  const b = await readJson(bookingKey(bookingId), Booking);
  if (!b?.refund) return null;
  if (b.creditNote) return readInvoice(b.creditNote.fy, b.creditNote.number);
  const rv = await ensureBookingReceipt(bookingId, deps);
  if (!rv) return null;
  const settings = deps.settings ?? (await getSettings());
  const at = deps.now ?? new Date(b.refund.at);
  const fy = financialYear(at);
  const { number, seq } = await allocateNumber('credit_note', fy, b.id, settings.tax.invoicePrefix);
  const doc = await persist(buildCreditNote(rv, b.refund.amount, { number, seq, fy, issuedAt: at.toISOString() }, b.refund.reason), deps.skipPdf);
  await writeJsonCas(bookingKey(bookingId), Booking, (x) => {
    if (!x) throw new Error('booking missing');
    return x.creditNote ? x : { ...x, creditNote: refOf(doc) };
  });
  return doc;
}

/** Fire-and-forget wrapper for hooks: never throws. */
export async function quietly<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.error(`invoice: ${label} failed`, err instanceof Error ? err.message : '');
    return null;
  }
}

/** Stored PDF bytes, or rendered from the JSON (and cached) when missing. */
export async function invoicePdf(doc: InvoiceDoc): Promise<Uint8Array> {
  const key = invoicePdfKey(doc.fy, doc.number);
  const b64 = await readText(key).catch(() => null);
  if (b64) return new Uint8Array(Buffer.from(b64, 'base64'));
  const bytes = await renderInvoicePdf(doc);
  await writeText(key, Buffer.from(bytes).toString('base64')).catch(() => undefined);
  return bytes;
}

/** All documents of a financial year (admin ledger). */
export async function listInvoices(fy: string): Promise<InvoiceDoc[]> {
  const keys = (await listKeys(`invoices/${fy}/`)).map((k) => k.key).filter((k) => k.endsWith('.json'));
  const docs = await Promise.all(keys.map((k) => readJson(k, InvoiceDoc).catch(() => null)));
  return docs.filter((d): d is InvoiceDoc => !!d);
}

/** Documents attached to an order (invoice, credit note, and booking receipt if converted). */
export async function documentsForOrder(o: Order): Promise<InvoiceDoc[]> {
  const out: InvoiceDoc[] = [];
  for (const r of [o.invoice, o.creditNote]) if (r) {
    const d = await readInvoice(r.fy, r.number);
    if (d) out.push(d);
  }
  return out;
}
