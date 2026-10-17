// A14: customer-facing document links for an order or booking.

import 'server-only';
import type { Order } from '@/lib/schemas/order';
import type { Booking } from '@/lib/schemas/bookings';
import type { InvoiceKind } from '@/lib/schemas/invoices';
import { KIND_TITLES } from './compute';
import { invoiceDownloadPath } from './access';
import { ensureBookingReceipt, ensureOrderInvoice, quietly } from './store';

export interface DocumentLink {
  kind: InvoiceKind;
  label: string;
  number: string;
  url: string;
}

type Ref = { number: string; fy: string } | undefined;

async function link(kind: InvoiceKind, ref: Ref): Promise<DocumentLink | null> {
  if (!ref) return null;
  const url = await invoiceDownloadPath(ref.fy, ref.number);
  return url ? { kind, label: KIND_TITLES[kind], number: ref.number, url } : null;
}

/** Links for an order; issues the invoice first if a paid order lacks one (self-healing). */
export async function orderDocumentLinks(o: Order): Promise<DocumentLink[]> {
  let inv: Ref = o.invoice;
  if (!inv && o.razorpayPaymentId && o.stockCommittedAt) inv = (await quietly('lazy invoice', () => ensureOrderInvoice(o.id))) ?? undefined;
  const out = await Promise.all([link('invoice', inv), link('credit_note', o.creditNote)]);
  return out.filter((x): x is DocumentLink => !!x);
}

export async function bookingDocumentLinks(b: Booking): Promise<DocumentLink[]> {
  let rv: Ref = b.receipt;
  if (!rv && b.depositPaymentId) rv = (await quietly('lazy receipt', () => ensureBookingReceipt(b.id))) ?? undefined;
  const out = await Promise.all([link('receipt', rv), link('credit_note', b.creditNote)]);
  return out.filter((x): x is DocumentLink => !!x);
}
