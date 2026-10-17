'use client';
// A13: open Razorpay Checkout.js for a booking deposit / balance and verify.

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

/** Resolves 'paid' (verified or still confirming) or 'dismissed'; rejects with a message. */
export async function payWithRazorpay(opts: CheckoutOpts, description: string): Promise<'paid' | 'dismissed'> {
  await loadCheckoutJs();
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: opts.key,
      order_id: opts.orderId,
      amount: opts.amount,
      currency: opts.currency,
      name: opts.name,
      description,
      prefill: opts.prefill,
      theme: { color: '#0B0B0B' },
      modal: { ondismiss: () => resolve('dismissed') },
      handler: async (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        const vr = await fetch('/api/razorpay/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(r),
        }).catch(() => null);
        if (!vr || vr.ok || vr.status >= 500) return resolve('paid');
        const vj = (await vr.json().catch(() => ({}))) as { error?: string };
        reject(new Error(vj.error || 'Payment could not be verified. You have not been charged twice.'));
      },
    });
    rzp.on('payment.failed', (r) => reject(new Error(r.error?.description || 'Payment failed. Please try again.')));
    rzp.open();
  });
}
