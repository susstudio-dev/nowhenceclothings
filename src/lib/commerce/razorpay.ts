// Razorpay over plain fetch + WebCrypto (no Node SDK, runs on Workers).
// Env is read at call time: OpenNext fills process.env per request.

const API = 'https://api.razorpay.com/v1';

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
}

export function razorpayConfig(): RazorpayConfig | null {
  const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret, webhookSecret: (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim() };
}

const enc = new TextEncoder();

/** Lower-case hex HMAC-SHA256. */
export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time string compare (length leak only). */
export function timingSafeEqual(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** Checkout callback: HMAC(order_id + "|" + payment_id, key_secret). */
export async function verifyPaymentSignature(
  p: { razorpayOrderId: string; razorpayPaymentId: string; signature: string },
  keySecret: string,
): Promise<boolean> {
  if (!keySecret || !p.signature) return false;
  const expected = await hmacSha256Hex(keySecret, `${p.razorpayOrderId}|${p.razorpayPaymentId}`);
  return timingSafeEqual(expected, p.signature.trim().toLowerCase());
}

/** Webhook: HMAC(raw body, webhook_secret) in `x-razorpay-signature`. */
export async function verifyWebhookSignature(rawBody: string, signature: string | null, secret: string): Promise<boolean> {
  if (!secret || !signature) return false;
  const expected = await hmacSha256Hex(secret, rawBody);
  return timingSafeEqual(expected, signature.trim().toLowerCase());
}

function authHeader(cfg: RazorpayConfig): string {
  return `Basic ${btoa(`${cfg.keyId}:${cfg.keySecret}`)}`;
}

export class RazorpayError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'RazorpayError';
  }
}

async function call<T>(cfg: RazorpayConfig, path: string, body: unknown, fetchImpl: typeof fetch = fetch): Promise<T> {
  const res = await fetchImpl(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: authHeader(cfg), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: { description?: string } };
  if (!res.ok) throw new RazorpayError(json.error?.description || `Razorpay ${path} failed`, res.status);
  return json as T;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status: string;
}

export function createRazorpayOrder(
  cfg: RazorpayConfig,
  p: { amount: number; receipt: string; notes: Record<string, string> },
  fetchImpl?: typeof fetch,
): Promise<RazorpayOrder> {
  return call<RazorpayOrder>(cfg, '/orders', { amount: p.amount, currency: 'INR', receipt: p.receipt, notes: p.notes }, fetchImpl);
}

export function refundPayment(
  cfg: RazorpayConfig,
  paymentId: string,
  amount: number,
  notes: Record<string, string> = {},
  fetchImpl?: typeof fetch,
): Promise<{ id: string; amount: number; status: string }> {
  return call(cfg, `/payments/${encodeURIComponent(paymentId)}/refund`, { amount, speed: 'normal', notes }, fetchImpl);
}
