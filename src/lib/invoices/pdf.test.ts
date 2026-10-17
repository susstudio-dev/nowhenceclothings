import { describe, expect, it } from 'vitest';
import { SettingsDoc } from '@/lib/schemas/settings';
import { buildOrderInvoice } from './compute';
import { pdfSafe, renderInvoicePdf } from './pdf';

describe('invoice pdf', () => {
  it('replaces glyphs the standard fonts cannot encode', () => {
    expect(pdfSafe('₹2,499 — Polo “Navy”')).toBe('Rs.2,499 - Polo "Navy"');
  });

  it('renders a PDF for a many-line invoice', async () => {
    const s = SettingsDoc.parse({ shipping: { flatFee: 0, freeShippingThreshold: 0 }, store: { email: 'a@b.co' } });
    const at = '2025-08-01T10:00:00.000Z';
    const line = { sku: 'A', productId: 'p1', title: 'Embossed polo — ₹ test', colour: 'Rust', size: 'M' as const, qty: 1, unitPrice: 329900 };
    const inv = buildOrderInvoice(
      {
        id: 'o',
        number: 'NWH-250801-ABCD',
        email: 'a@b.co',
        phone: '9876543210',
        shippingAddress: { name: 'A', line1: '1', line2: '', city: 'Pune', state: 'Maharashtra', pincode: '411001', country: 'IN' },
        lines: Array.from({ length: 40 }, () => line),
        subtotal: 40 * 329900,
        discount: 0,
        shipping: 0,
        total: 40 * 329900,
        status: 'paid',
        razorpayOrderId: 'x',
        emailsSent: [],
        history: [{ at, status: 'paid', by: 'x' }],
        notes: '',
        createdAt: at,
        updatedAt: at,
      },
      s,
      () => undefined,
      { number: 'NWH/25-26/0001', seq: 1, fy: '25-26', issuedAt: at },
    );
    const bytes = await renderInvoicePdf(inv);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(2000);
  });
});
