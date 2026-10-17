// A14: pure builders for tax invoices, receipt vouchers and credit notes.

import type { Address } from '@/lib/schemas/common';
import type { Order } from '@/lib/schemas/order';
import type { Booking } from '@/lib/schemas/bookings';
import type { SettingsDoc } from '@/lib/schemas/settings';
import type { InvoiceDoc, InvoiceKind, InvoiceLine } from '@/lib/schemas/invoices';
import { GST_STATES, allocate, amountInWords, rateForUnit, splitInclusive, splitTax, stateCodeFromName } from './gst';

/** SAC for courier / delivery charges (taxed at the principal supply's rate). */
export const SHIPPING_SAC = '996812';

export type TaxSettings = Pick<SettingsDoc, 'tax' | 'legal' | 'store'>;

export function invoiceNumber(prefix: string, kind: InvoiceKind, fy: string, seq: number): string {
  const series = kind === 'invoice' ? '' : kind === 'receipt' ? 'RV/' : 'CN/';
  return `${prefix}/${series}${fy}/${String(seq).padStart(4, '0')}`;
}

export function sellerOf(s: TaxSettings): InvoiceDoc['seller'] {
  const gstin = s.legal.gstin.trim().toUpperCase();
  const stateCode = s.legal.stateCode || (/^\d{2}/.test(gstin) ? gstin.slice(0, 2) : '');
  return {
    legalName: s.legal.legalName || s.store.name,
    gstin,
    address: s.legal.registeredAddress || s.store.address,
    state: GST_STATES[stateCode] ?? '',
    stateCode,
  };
}

function placeOfSupply(shipping: Address): { state: string; code: string } {
  const code = stateCodeFromName(shipping.state) ?? '';
  return { state: GST_STATES[code] ?? shipping.state, code };
}

function sumLines(lines: InvoiceLine[]): InvoiceDoc['totals'] {
  const t = { gross: 0, discount: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0, total: 0 };
  for (const l of lines) {
    t.gross += l.gross;
    t.discount += l.discount;
    t.taxable += l.taxable;
    t.cgst += l.cgst;
    t.sgst += l.sgst;
    t.igst += l.igst;
    t.total += l.total;
  }
  t.tax = t.cgst + t.sgst + t.igst;
  return t;
}

function taxLine(
  base: { description: string; hsn: string; qty: number; unitPrice: number; gross: number; discount: number },
  rate: number,
  intra: boolean,
): InvoiceLine {
  const total = base.gross - base.discount;
  const { taxable, tax } = splitInclusive(total, rate);
  return { ...base, taxable, ratePercent: rate, ...splitTax(tax, intra), total };
}

export interface Numbered {
  number: string;
  seq: number;
  fy: string;
  issuedAt: string;
}

/**
 * Tax invoice for a paid order. Coupon discounts are allocated across goods
 * lines; a booking deposit is an advance (adjusted below the total), not a
 * discount. Shipping is billed at the highest goods rate.
 */
export function buildOrderInvoice(
  o: Order,
  s: TaxSettings,
  hsnFor: (productId: string) => string | undefined,
  n: Numbered,
  receiptNumber?: string,
): InvoiceDoc {
  const seller = sellerOf(s);
  const pos = placeOfSupply(o.shippingAddress);
  const intra = !!seller.stateCode && seller.stateCode === pos.code;
  const advance = o.bookingId ? (o.depositPaid ?? o.discount) : 0;
  const couponDiscount = o.bookingId ? Math.max(0, o.discount - advance) : o.discount;
  const grosses = o.lines.map((l) => l.unitPrice * l.qty);
  const discounts = allocate(couponDiscount, grosses);
  const goods = o.lines.map((l, i) => {
    const net = grosses[i]! - discounts[i]!;
    const rate = rateForUnit(Math.round(net / l.qty), s.tax.slabs, s.tax.gstRatePercent);
    return taxLine(
      {
        description: `${l.title} — ${l.colour}, ${l.size}`,
        hsn: hsnFor(l.productId) ?? s.tax.defaultHsn,
        qty: l.qty,
        unitPrice: l.unitPrice,
        gross: grosses[i]!,
        discount: discounts[i]!,
      },
      rate,
      intra,
    );
  });
  const lines = [...goods];
  if (o.shipping > 0) {
    const rate = Math.max(0, ...goods.map((g) => g.ratePercent));
    lines.push(taxLine({ description: 'Shipping and handling', hsn: SHIPPING_SAC, qty: 1, unitPrice: o.shipping, gross: o.shipping, discount: 0 }, rate, intra));
  }
  const totals = sumLines(lines);
  const payable = totals.total - advance;
  const notes = ['Prices are inclusive of GST. Taxable value is back-calculated from the inclusive price.'];
  if (!seller.gstin) notes.push('Seller GSTIN not yet configured.');
  if (advance) notes.push(`Advance of Rs. ${(advance / 100).toFixed(2)} received${receiptNumber ? ` vide receipt ${receiptNumber}` : ''} is adjusted.`);
  return {
    kind: 'invoice',
    number: n.number,
    fy: n.fy,
    seq: n.seq,
    issuedAt: n.issuedAt,
    source: { type: 'order', id: o.id, number: o.number },
    ...(receiptNumber ? { reference: receiptNumber } : {}),
    seller,
    buyer: {
      name: (o.billingAddress ?? o.shippingAddress).name,
      email: o.email,
      phone: o.phone,
      ...(o.buyerGstin ? { gstin: o.buyerGstin } : {}),
      billing: o.billingAddress ?? o.shippingAddress,
      shipping: o.shippingAddress,
    },
    placeOfSupply: pos,
    intraState: intra,
    lines,
    totals,
    advanceAdjusted: advance,
    amountPayable: payable,
    amountInWords: amountInWords(payable),
    notes,
  };
}

/** Receipt voucher for a booking deposit (advance for goods; no GST is payable on it). */
export function buildBookingReceipt(b: Booking, s: TaxSettings, n: Numbered): InvoiceDoc {
  const seller = sellerOf(s);
  const shipping: Address = b.address ?? { name: b.name, line1: '—', line2: '', city: '—', state: seller.state || '—', pincode: '110001', country: 'IN' };
  const pos = b.address ? placeOfSupply(b.address) : { state: seller.state, code: seller.stateCode };
  const line: InvoiceLine = {
    description: `Advance for ${b.productTitle} — ${b.colour}, ${b.size} (booking ${b.number})`,
    hsn: s.tax.defaultHsn,
    qty: b.qty,
    unitPrice: Math.round(b.deposit / b.qty),
    gross: b.deposit,
    discount: 0,
    taxable: b.deposit,
    ratePercent: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    total: b.deposit,
  };
  return {
    kind: 'receipt',
    number: n.number,
    fy: n.fy,
    seq: n.seq,
    issuedAt: n.issuedAt,
    source: { type: 'booking', id: b.id, number: b.number },
    seller,
    buyer: { name: b.name, email: b.email, phone: b.phone, ...(b.buyerGstin ? { gstin: b.buyerGstin } : {}), billing: b.billingAddress ?? shipping, shipping },
    placeOfSupply: pos,
    intraState: !!seller.stateCode && seller.stateCode === pos.code,
    lines: [line],
    totals: { gross: b.deposit, discount: 0, taxable: b.deposit, cgst: 0, sgst: 0, igst: 0, tax: 0, total: b.deposit },
    advanceAdjusted: 0,
    amountPayable: b.deposit,
    amountInWords: amountInWords(b.deposit),
    notes: [
      'Receipt voucher for an advance against a future supply of goods.',
      'GST on this advance is not payable at receipt (Notification 66/2017-Central Tax); it is charged on the tax invoice issued at sale.',
    ],
  };
}

/**
 * Credit note reversing `amount` of an invoice / receipt. A full refund mirrors
 * every line; a partial one is spread across lines in proportion to their totals.
 */
export function buildCreditNote(ref: InvoiceDoc, amount: number, n: Numbered, reason: string): InvoiceDoc {
  const amt = Math.min(amount, ref.totals.total);
  const parts = allocate(amt, ref.lines.map((l) => l.total));
  const lines = ref.lines
    .map((l, i) => {
      if (parts[i] === l.total) return { ...l };
      return taxLine({ description: l.description, hsn: l.hsn, qty: l.qty, unitPrice: l.unitPrice, gross: parts[i]!, discount: 0 }, l.ratePercent, ref.intraState);
    })
    .filter((l) => l.total > 0);
  const totals = sumLines(lines);
  return {
    ...ref,
    kind: 'credit_note',
    number: n.number,
    fy: n.fy,
    seq: n.seq,
    issuedAt: n.issuedAt,
    reference: ref.number,
    lines,
    totals,
    advanceAdjusted: 0,
    amountPayable: totals.total,
    amountInWords: amountInWords(totals.total),
    notes: [`Credit note against ${ref.number}.`, ...(reason ? [`Reason: ${reason}`] : [])],
  };
}

export const KIND_TITLES: Record<InvoiceKind, string> = {
  invoice: 'Tax Invoice',
  receipt: 'Receipt Voucher',
  credit_note: 'Credit Note',
};

/** Accounting ledger CSV (one row per document). */
export const LEDGER_HEADER = [
  'Type', 'Number', 'Date', 'Source', 'Buyer', 'Buyer GSTIN', 'Place of supply', 'State code',
  'Taxable', 'CGST', 'SGST', 'IGST', 'Total', 'Advance adjusted', 'Payable', 'Reference',
];

const csvCell = (v: string | number) => {
  const s = String(v);
  if (/^-?\d+(\.\d+)?$/.test(s)) return s;
  return /[",\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : s;
};
const rs = (p: number) => (p / 100).toFixed(2);

export function ledgerCsv(docs: InvoiceDoc[]): string {
  const sign = (d: InvoiceDoc) => (d.kind === 'credit_note' ? -1 : 1);
  const rows = [...docs]
    .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt) || a.number.localeCompare(b.number))
    .map((d) =>
      [
        KIND_TITLES[d.kind], d.number, d.issuedAt.slice(0, 10), d.source.number, d.buyer.name, d.buyer.gstin ?? '',
        d.placeOfSupply.state, d.placeOfSupply.code,
        rs(sign(d) * d.totals.taxable), rs(sign(d) * d.totals.cgst), rs(sign(d) * d.totals.sgst), rs(sign(d) * d.totals.igst),
        rs(sign(d) * d.totals.total), rs(d.advanceAdjusted), rs(sign(d) * d.amountPayable), d.reference ?? '',
      ].map(csvCell).join(','),
    );
  return [LEDGER_HEADER.join(','), ...rows].join('\r\n') + '\r\n';
}
