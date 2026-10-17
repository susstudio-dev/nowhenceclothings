import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Order } from '@/lib/schemas/order';
import { escapeHtml, renderOrderEmail, sendEmail } from './email';

const order: Order = {
  id: 'o1',
  number: 'NWH-261017-AB12',
  email: 'a@b.co',
  phone: '9876543210',
  shippingAddress: { name: 'Asha <b>K</b>', line1: 'x', line2: '', city: 'Pune', state: 'Maharashtra', pincode: '411001', country: 'IN' },
  lines: [{ sku: 'A', productId: 'p', title: 'Tee', colour: 'Black', size: 'M', qty: 2, unitPrice: 149900 }],
  subtotal: 299800,
  discount: 0,
  shipping: 9900,
  total: 309700,
  status: 'paid',
  razorpayOrderId: 'order_1',
  emailsSent: [],
  history: [{ at: '2026-10-17T00:00:00.000Z', status: 'paid', by: 'webhook' }],
  notes: '',
  createdAt: '2026-10-17T00:00:00.000Z',
  updatedAt: '2026-10-17T00:00:00.000Z',
};
const settings = { email: { from: 'Nowhence <orders@x.com>', replyTo: '', senderName: '' } };
const asFetch = (f: unknown) => f as typeof fetch;

afterEach(() => {
  delete process.env.RESEND_API_KEY;
});

describe('order emails', () => {
  it('confirmation shows ship-by for pre-orders', () => {
    const m = renderOrderEmail({ ...order, preorder: true, shipBy: '2026-12-15' }, 'confirmation', settings);
    expect(m.html).toContain('Pre-order');
    expect(m.html).toMatch(/15 December 2026/);
    expect(renderOrderEmail(order, 'confirmation', settings).html).not.toContain('Pre-order');
  });
  it('escapes html', () => expect(escapeHtml(`<a href="x">'&`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;'));
  it('renders confirmation with escaped name', () => {
    const m = renderOrderEmail(order, 'confirmation', settings);
    expect(m.subject).toContain('NWH-261017-AB12');
    expect(m.to).toBe('a@b.co');
    expect(m.html).toContain('Asha');
    expect(m.html).not.toContain('<b>K');
    expect(m.replyTo).toBeUndefined();
  });
  it('uses the sender name in From', () => {
    const m = renderOrderEmail(order, 'confirmation', { email: { ...settings.email, senderName: 'Nowhence Studio' } } as typeof settings);
    expect(m.from).toBe('Nowhence Studio <orders@x.com>');
    expect(renderOrderEmail(order, 'confirmation', settings).from).toBe('Nowhence <orders@x.com>');
  });
  it('renders shipped and refunded', () => {
    const shipped = renderOrderEmail({ ...order, tracking: { carrier: 'Delhivery', number: '123' } }, 'shipped', settings);
    expect(shipped.html).toContain('Delhivery');
    expect(renderOrderEmail(order, 'refunded', settings).subject).toContain('Refund');
  });
  it('skips without a key', async () => {
    const f = vi.fn();
    expect(await sendEmail(renderOrderEmail(order, 'confirmation', settings), asFetch(f))).toEqual({ sent: false, reason: 'no_key' });
    expect(f).not.toHaveBeenCalled();
  });
  it('posts to Resend with a key', async () => {
    process.env.RESEND_API_KEY = 're_test';
    const f = vi.fn(async () => new Response(JSON.stringify({ id: 'em_1' })));
    expect(await sendEmail(renderOrderEmail(order, 'confirmation', settings), asFetch(f))).toEqual({ sent: true, id: 'em_1' });
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_test');
  });
  it('reports API errors', async () => {
    process.env.RESEND_API_KEY = 're_test';
    const f = vi.fn(async () => new Response(JSON.stringify({ message: 'bad from' }), { status: 422 }));
    expect(await sendEmail(renderOrderEmail(order, 'confirmation', settings), asFetch(f))).toMatchObject({
      sent: false,
      reason: 'error',
      detail: 'bad from',
    });
  });
});
