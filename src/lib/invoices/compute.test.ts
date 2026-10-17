import { describe, expect, it } from 'vitest';
import { SettingsDoc } from '@/lib/schemas/settings';
import { InvoiceDoc } from '@/lib/schemas/invoices';
import type { Order } from '@/lib/schemas/order';
import type { Booking } from '@/lib/schemas/bookings';
import { buildBookingReceipt, buildCreditNote, buildOrderInvoice, invoiceNumber, ledgerCsv, sellerOf } from './compute';

const settings = SettingsDoc.parse({
  shipping: { flatFee: 9900, freeShippingThreshold: 299900 },
  store: { email: 'hello@example.com' },
  legal: { legalName: 'Nowhence Clothing LLP', gstin: '29AAPFU0939F1ZQ', registeredAddress: 'Bengaluru' },
});
const at = '2025-08-01T10:00:00.000Z';
const addr = (state: string) => ({ name: 'Asha', line1: '1 Road', line2: '', city: 'X', state, pincode: '560001', country: 'IN' as const });

function order(p: Partial<Order> = {}): Order {
  return {
    id: 'o1',
    number: 'NWH-250801-ABCD',
    email: 'a@b.co',
    phone: '9876543210',
    shippingAddress: addr('Karnataka'),
    lines: [
      { sku: 'A', productId: 'p1', title: 'Polo', colour: 'Navy', size: 'M', qty: 1, unitPrice: 329900 },
      { sku: 'B', productId: 'p2', title: 'Tee', colour: 'Cream', size: 'L', qty: 2, unitPrice: 149900 },
    ],
    subtotal: 629700,
    discount: 0,
    shipping: 0,
    total: 629700,
    status: 'paid',
    razorpayOrderId: 'order_1',
    razorpayPaymentId: 'pay_1',
    emailsSent: [],
    history: [{ at, status: 'paid', by: 'customer' }],
    notes: '',
    createdAt: at,
    updatedAt: at,
    ...p,
  };
}
const n = { number: 'NWH/25-26/0001', seq: 1, fy: '25-26', issuedAt: at };

describe('invoice compute', () => {
  it('numbers by series', () => {
    expect(invoiceNumber('NWH', 'invoice', '25-26', 7)).toBe('NWH/25-26/0007');
    expect(invoiceNumber('NWH', 'receipt', '25-26', 1)).toBe('NWH/RV/25-26/0001');
    expect(invoiceNumber('NWH', 'credit_note', '25-26', 12)).toBe('NWH/CN/25-26/0012');
  });

  it('derives seller state from GSTIN', () => {
    expect(sellerOf(settings)).toMatchObject({ stateCode: '29', state: 'Karnataka' });
  });

  it('intra-state: CGST+SGST, slab per unit, totals reconcile to order total', () => {
    const inv = InvoiceDoc.parse(buildOrderInvoice(order(), settings, () => undefined, n));
    expect(inv.intraState).toBe(true);
    expect(inv.lines[0]).toMatchObject({ ratePercent: 18, hsn: '6105', taxable: 279576 });
    expect(inv.lines[1]).toMatchObject({ ratePercent: 5, taxable: 285524 });
    expect(inv.totals.igst).toBe(0);
    expect(inv.totals.cgst + inv.totals.sgst).toBe(inv.totals.tax);
    expect(inv.totals.taxable + inv.totals.tax).toBe(629700);
    expect(inv.amountPayable).toBe(629700);
    expect(inv.amountInWords).toBe('Rupees Six Thousand Two Hundred Ninety Seven Only');
  });

  it('inter-state: IGST; product HSN wins; shipping at highest rate', () => {
    const o = order({ shippingAddress: addr('Maharashtra'), lines: [order().lines[1]!], subtotal: 299800, shipping: 9900, total: 309700 });
    const inv = buildOrderInvoice(o, settings, (id) => (id === 'p2' ? '6109' : undefined), n);
    expect(inv.intraState).toBe(false);
    expect(inv.placeOfSupply).toEqual({ state: 'Maharashtra', code: '27' });
    expect(inv.lines[0]!.hsn).toBe('6109');
    expect(inv.lines[1]).toMatchObject({ hsn: '996812', ratePercent: 5 });
    expect(inv.totals.cgst).toBe(0);
    expect(inv.totals.total).toBe(309700);
  });

  it('allocates coupon discount; discount can move a unit into the lower slab', () => {
    const o = order({ lines: [order().lines[0]!], subtotal: 329900, discount: 80000, total: 249900 });
    const inv = buildOrderInvoice(o, settings, () => undefined, n);
    expect(inv.lines[0]).toMatchObject({ discount: 80000, total: 249900, ratePercent: 5 });
    expect(inv.totals.total).toBe(249900);
  });

  it('booking orders adjust the deposit as an advance, not a discount', () => {
    const o = order({ lines: [order().lines[0]!], subtotal: 329900, discount: 99900, total: 230000, bookingId: 'b1', depositPaid: 99900 });
    const inv = buildOrderInvoice(o, settings, () => undefined, n, 'NWH/RV/25-26/0001');
    expect(inv.totals.total).toBe(329900);
    expect(inv.lines[0]!.ratePercent).toBe(18);
    expect(inv.advanceAdjusted).toBe(99900);
    expect(inv.amountPayable).toBe(230000);
    expect(inv.reference).toBe('NWH/RV/25-26/0001');
  });

  it('billing address and buyer GSTIN go on the invoice; place of supply follows shipping', () => {
    const inv = buildOrderInvoice(order({ billingAddress: addr('Kerala'), buyerGstin: '32AAPFU0939F1ZP' }), settings, () => undefined, n);
    expect(inv.buyer.billing.state).toBe('Kerala');
    expect(inv.buyer.gstin).toBe('32AAPFU0939F1ZP');
    expect(inv.placeOfSupply.code).toBe('29');
  });

  it('receipt voucher for a deposit carries no tax', () => {
    const b = {
      id: 'b1',
      number: 'NWB-250801-ABCD',
      name: 'Asha',
      email: 'a@b.co',
      phone: '9876543210',
      productTitle: 'Polo',
      colour: 'Rust',
      size: 'M',
      qty: 1,
      deposit: 99900,
      history: [],
      address: addr('Goa'),
    } as unknown as Booking;
    const rv = InvoiceDoc.parse(buildBookingReceipt(b, settings, { ...n, number: 'NWH/RV/25-26/0001' }));
    expect(rv.kind).toBe('receipt');
    expect(rv.totals).toMatchObject({ total: 99900, tax: 0 });
  });

  it('credit notes mirror full refunds and spread partial ones', () => {
    const inv = buildOrderInvoice(order(), settings, () => undefined, n);
    const full = buildCreditNote(inv, inv.totals.total, { ...n, number: 'NWH/CN/25-26/0001' }, 'Returned');
    expect(full.totals).toEqual(inv.totals);
    expect(full.reference).toBe(inv.number);
    const part = buildCreditNote(inv, 100000, { ...n, number: 'NWH/CN/25-26/0002' }, '');
    expect(part.totals.total).toBe(100000);
    expect(part.totals.taxable + part.totals.tax).toBe(100000);
  });

  it('exports a ledger CSV with credit notes negative', () => {
    const inv = buildOrderInvoice(order(), settings, () => undefined, n);
    const cn = buildCreditNote(inv, inv.totals.total, { ...n, number: 'NWH/CN/25-26/0001' }, '');
    const csv = ledgerCsv([inv, cn]).trim().split('\r\n');
    expect(csv).toHaveLength(3);
    expect(csv[1]).toContain('Tax Invoice,NWH/25-26/0001');
    expect(csv[2]).toContain(',-6297.00,');
  });
});
