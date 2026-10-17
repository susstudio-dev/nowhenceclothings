import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  createRazorpayOrder,
  hmacSha256Hex,
  RazorpayError,
  timingSafeEqual,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from './razorpay';

const node = (secret: string, msg: string) => createHmac('sha256', secret).update(msg).digest('hex');

describe('razorpay signatures', () => {
  it('hmac matches node crypto', async () => {
    expect(await hmacSha256Hex('s3cret', 'hello')).toBe(node('s3cret', 'hello'));
  });
  it('timingSafeEqual', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
  });
  it('verifies the checkout payment signature', async () => {
    const sig = node('key', 'order_1|pay_1');
    const p = { razorpayOrderId: 'order_1', razorpayPaymentId: 'pay_1', signature: sig };
    expect(await verifyPaymentSignature(p, 'key')).toBe(true);
    expect(await verifyPaymentSignature({ ...p, razorpayPaymentId: 'pay_2' }, 'key')).toBe(false);
    expect(await verifyPaymentSignature(p, 'other')).toBe(false);
    expect(await verifyPaymentSignature(p, '')).toBe(false);
    expect(await verifyPaymentSignature({ ...p, signature: '' }, 'key')).toBe(false);
  });
  it('verifies the webhook signature over the raw body', async () => {
    const body = '{"event":"payment.captured"}';
    expect(await verifyWebhookSignature(body, node('wh', body), 'wh')).toBe(true);
    expect(await verifyWebhookSignature(`${body} `, node('wh', body), 'wh')).toBe(false);
    expect(await verifyWebhookSignature(body, null, 'wh')).toBe(false);
    expect(await verifyWebhookSignature(body, node('wh', body), '')).toBe(false);
  });
});

describe('createRazorpayOrder', () => {
  const cfg = { keyId: 'rzp_test_x', keySecret: 'sec', webhookSecret: '' };
  it('posts with basic auth', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ id: 'order_9', amount: 100, currency: 'INR', status: 'created' })));
    const o = await createRazorpayOrder(cfg, { amount: 100, receipt: 'NWH', notes: {} }, f as unknown as typeof fetch);
    expect(o.id).toBe('order_9');
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.razorpay.com/v1/orders');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${btoa('rzp_test_x:sec')}`);
    expect(JSON.parse(init.body as string)).toMatchObject({ amount: 100, currency: 'INR', receipt: 'NWH' });
  });
  it('throws RazorpayError on failure', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ error: { description: 'bad' } }), { status: 400 }));
    await expect(
      createRazorpayOrder(cfg, { amount: 1, receipt: 'r', notes: {} }, f as unknown as typeof fetch),
    ).rejects.toBeInstanceOf(RazorpayError);
  });
});
