import { afterAll, describe, expect, it } from 'vitest';
import { createJson, deleteKey, listKeys, readJson, writeJsonCas } from '@/lib/storage';
import { SettingsDoc } from '@/lib/schemas/settings';
import { Order, orderKey } from '@/lib/schemas/order';
import { invoiceCounterKey, InvoiceCounterDoc } from '@/lib/schemas/invoices';
import { allocateNumber, ensureOrderCreditNote, ensureOrderInvoice, invoicePdf, listInvoices } from './store';

// Dev filesystem backend. A paid date in FY 00-01 keeps these docs apart from real ones.
const FY = '00-01';
const at = '2000-08-01T10:00:00.000Z';
const settings = SettingsDoc.parse({
  shipping: { flatFee: 9900, freeShippingThreshold: 299900 },
  store: { email: 'hello@example.com' },
  legal: { legalName: 'Test LLP', gstin: '29AAPFU0939F1ZQ' },
});
const orderIds: string[] = [];

afterAll(async () => {
  for (const k of await listKeys(`invoices/${FY}/`)) await deleteKey(k.key);
  await deleteKey(invoiceCounterKey(FY));
  for (const id of orderIds) await deleteKey(orderKey(id)).catch(() => undefined);
});

async function paidOrder(): Promise<string> {
  const id = `test-inv-${crypto.randomUUID()}`;
  orderIds.push(id);
  const o: Order = Order.parse({
    id,
    number: 'NWH-000801-ABCD',
    email: 'a@b.co',
    phone: '9876543210',
    shippingAddress: { name: 'A', line1: '1', city: 'Pune', state: 'Maharashtra', pincode: '411001' },
    lines: [{ sku: 'A', productId: 'p1', title: 'Polo', colour: 'Navy', size: 'M', qty: 1, unitPrice: 329900 }],
    subtotal: 329900,
    discount: 0,
    shipping: 0,
    total: 329900,
    status: 'paid',
    razorpayOrderId: 'order_x',
    razorpayPaymentId: 'pay_x',
    history: [{ at, status: 'paid', by: 'customer' }],
    createdAt: at,
    updatedAt: at,
  });
  await createJson(orderKey(id), Order, o);
  return id;
}

describe('invoice store', () => {
  it('numbers sequentially with no gaps or duplicates under concurrency', async () => {
    const ids = Array.from({ length: 8 }, (_, i) => `src-${i}`);
    const all = [...ids, ...ids];
    const res = await Promise.all(all.map((id) => allocateNumber('receipt', FY, id, 'TST')));
    const byId = new Map<string, string>();
    all.forEach((id, i) => {
      if (byId.has(id)) expect(res[i]!.number).toBe(byId.get(id));
      byId.set(id, res[i]!.number);
    });
    const seqs = [...new Set(res.map((r) => r.seq))].sort((a, b) => a - b);
    expect(seqs).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const counter = await readJson(invoiceCounterKey(FY), InvoiceCounterDoc);
    expect(counter?.receipt).toBe(8);
  });

  it('issues an order invoice once, even when called concurrently', async () => {
    const id = await paidOrder();
    const [a, b] = await Promise.all([
      ensureOrderInvoice(id, { settings, skipPdf: true }),
      ensureOrderInvoice(id, { settings, skipPdf: true }),
    ]);
    expect(a!.number).toBe(b!.number);
    expect(a!.number).toMatch(/^NWH\/00-01\/\d{4}$/);
    const again = await ensureOrderInvoice(id, { settings });
    expect(again!.number).toBe(a!.number);
    const o = await readJson(orderKey(id), Order);
    expect(o!.invoice!.number).toBe(a!.number);
    const pdf = await invoicePdf(a!);
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-');
  });

  it('issues a credit note for a refunded order and lists the FY ledger', async () => {
    const id = await paidOrder();
    await ensureOrderInvoice(id, { settings, skipPdf: true });
    await writeJsonCas(orderKey(id), Order, (o) => ({ ...o!, status: 'refunded' as const, refund: { amount: 329900, at, reason: 'Returned' } }));
    const cn = await ensureOrderCreditNote(id, { settings, skipPdf: true });
    expect(cn!.kind).toBe('credit_note');
    expect(cn!.number).toMatch(/^NWH\/CN\/00-01\//);
    const again = await ensureOrderCreditNote(id, { settings, skipPdf: true });
    expect(again!.number).toBe(cn!.number);
    const all = await listInvoices(FY);
    expect(all.some((d) => d.number === cn!.number)).toBe(true);
  });

  it('never invoices a missing or unpaid order', async () => {
    expect(await ensureOrderInvoice(`test-inv-${crypto.randomUUID()}`, { settings })).toBeNull();
  });
});
