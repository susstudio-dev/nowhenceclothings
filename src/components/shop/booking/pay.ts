'use client';
// A13: open Razorpay Checkout.js for a booking deposit / balance and verify.

interface RazorpayInstance {
  open(): void;
  on(event: 'payment.failed', cb: (r: { error?: { description?: string } }) => void): void;
}
declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => RazorpayInstance;
  }
}

export interface CheckoutOpts {
  key: string;
  orderId: string;
  amount: number;
  currency: string;
  name: string;
  prefill: { name: string; email: string; contact: string };
}

function loadCheckoutJs(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load the payment window. Check your connection.'));
    document.body.appendChild(s);
  });
}

/**
 * Resolves 'paid' (verified or still confirming) or 'dismissed'; rejects with a message.
 * `onVerified` runs only when /api/razorpay/verify accepted the signature (analytics Purchase).
 */
export async function payWithRazorpay(opts: CheckoutOpts, description: string, onVerified?: () => void): Promise<'paid' | 'dismissed'> {
  await loadCheckoutJs();
  return new Promise((resolve, reject) => {
    // Razorpay keeps the modal open after a failed attempt so the buyer can retry;
    // surface the failure only if they then close it.
    let failed: string | null = null;
    const rzp = new window.Razorpay!({
      key: opts.key,
      order_id: opts.orderId,
      amount: opts.amount,
      currency: opts.currency,
      name: opts.name,
      description,
      prefill: opts.prefill,
      theme: { color: '#0B0B0B' },
      modal: { ondismiss: () => (failed ? reject(new Error(failed)) : resolve('dismissed')) },
      handler: async (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        const vr = await fetch('/api/razorpay/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(r),
        }).catch(() => null);
        if (vr?.ok) {
          try {
            onVerified?.();
          } catch {
            /* analytics must never block the flow */
          }
        }
        if (!vr || vr.ok || vr.status >= 500) return resolve('paid');
        const vj = (await vr.json().catch(() => ({}))) as { error?: string };
        reject(new Error(vj.error || 'Payment could not be verified. You have not been charged twice.'));
      },
    });
    rzp.on('payment.failed', (r) => {
      failed = r.error?.description || 'Payment failed. Please try again.';
    });
    rzp.open();
  });
}
