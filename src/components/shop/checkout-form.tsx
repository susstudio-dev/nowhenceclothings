'use client';
// S6: guest checkout → /api/checkout → Razorpay Checkout.js → /api/razorpay/verify.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button, Input, Select } from '@/components/ui';
import { clearCart, useCart } from '@/lib/commerce/cart-client';
import type { CheckoutResponse } from '@/lib/commerce/types';
import { useQuote } from '@/lib/commerce/use-quote';
import { CartLines, CartTotals, CouponForm } from './cart-lines';

export const LAST_ORDER_KEY = 'nowhence.lastOrder';

const STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh',
  'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal',
];

interface RazorpayInstance {
  open(): void;
  on(event: 'payment.failed', cb: (r: { error?: { description?: string } }) => void): void;
}
declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => RazorpayInstance;
  }
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

type Fields = Record<'email' | 'phone' | 'name' | 'line1' | 'line2' | 'city' | 'state' | 'pincode', string>;
const EMPTY: Fields = { email: '', phone: '', name: '', line1: '', line2: '', city: '', state: '', pincode: '' };

/** Client-side checks mirroring the server schema (the server re-validates). */
export function validateFields(f: Fields): Partial<Record<keyof Fields, string>> {
  const e: Partial<Record<keyof Fields, string>> = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Enter a valid email.';
  if (!/^[6-9]\d{9}$/.test(f.phone.replace(/\D/g, '').slice(-10))) e.phone = 'Enter a 10-digit mobile number.';
  if (!f.name.trim()) e.name = 'Enter your full name.';
  if (!f.line1.trim()) e.line1 = 'Enter your address.';
  if (!f.city.trim()) e.city = 'Enter your city.';
  if (!f.state) e.state = 'Choose your state.';
  if (!/^[1-9]\d{5}$/.test(f.pincode.trim())) e.pincode = 'Enter a 6-digit PIN code.';
  return e;
}

export function CheckoutForm() {
  const router = useRouter();
  const cart = useCart();
  const { quote, loading: quoting } = useQuote(cart.lines, cart.couponCode);
  const [f, setF] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const set = (k: keyof Fields) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  if (!cart.lines.length) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted">Your bag is empty.</p>
        <Link href="/shop" className="mt-4 inline-block underline">
          Continue shopping
        </Link>
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const v = validateFields(f);
    setErrors(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      const phone = f.phone.replace(/\D/g, '').slice(-10);
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: cart.lines.map((l) => ({ sku: l.sku, qty: l.qty })),
          couponCode: cart.couponCode,
          email: f.email.trim(),
          phone,
          address: {
            name: f.name, line1: f.line1, line2: f.line2, city: f.city, state: f.state, pincode: f.pincode.trim(),
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Checkout failed.');
      const data = json as CheckoutResponse;
      sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify({ number: data.number, email: f.email.trim() }));
      await loadCheckoutJs();
      const rzp = new window.Razorpay!({
        key: data.razorpay.key,
        order_id: data.razorpay.orderId,
        amount: data.razorpay.amount,
        currency: data.razorpay.currency,
        name: data.razorpay.name,
        description: `Order ${data.number}`,
        prefill: data.razorpay.prefill,
        theme: { color: '#141414' },
        modal: { ondismiss: () => setBusy(false) },
        handler: async (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            const vr = await fetch('/api/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(r),
            });
            if (vr.ok || vr.status >= 500) {
              clearCart();
              router.push('/checkout/confirmation');
              return;
            }
            const vj = await vr.json().catch(() => ({}));
            setFormError(vj.error || 'Payment could not be verified. You have not been charged twice.');
          } finally {
            setBusy(false);
          }
        },
      });
      rzp.on('payment.failed', (r) => setFormError(r.error?.description || 'Payment failed. Please try again.'));
      rzp.open();
    } catch (err) {
      setFormError((err as Error).message);
      setBusy(false);
    }
  }

  const blocked = Boolean(quote?.issues.length);

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_400px]">
      <form onSubmit={onSubmit} noValidate className="space-y-8" aria-describedby={formError ? 'checkout-error' : undefined}>
        <fieldset className="space-y-4">
          <legend className="mb-2 text-lg font-medium">Contact</legend>
          <Input label="Email" type="email" autoComplete="email" value={f.email} onChange={set('email')} error={errors.email} required />
          <Input
            label="Mobile number"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            value={f.phone}
            onChange={set('phone')}
            error={errors.phone}
            hint="For delivery updates."
            required
          />
        </fieldset>
        <fieldset className="space-y-4">
          <legend className="mb-2 text-lg font-medium">Shipping address</legend>
          <Input label="Full name" autoComplete="name" value={f.name} onChange={set('name')} error={errors.name} required />
          <Input label="Address" autoComplete="address-line1" value={f.line1} onChange={set('line1')} error={errors.line1} required />
          <Input label="Apartment, landmark (optional)" autoComplete="address-line2" value={f.line2} onChange={set('line2')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="City" autoComplete="address-level2" value={f.city} onChange={set('city')} error={errors.city} required />
            <Input
              label="PIN code"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={6}
              value={f.pincode}
              onChange={set('pincode')}
              error={errors.pincode}
              required
            />
          </div>
          <Select
            label="State"
            autoComplete="address-level1"
            placeholder="Choose state"
            options={STATES.map((s) => ({ value: s, label: s }))}
            value={f.state}
            onChange={set('state')}
            error={errors.state}
            required
          />
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-lg font-medium">Shipping</legend>
          <p className="text-sm">
            Standard shipping{quote?.shippingEta ? ` · ${quote.shippingEta}` : ''}
          </p>
        </fieldset>
        {formError && (
          <p id="checkout-error" role="alert" className="text-sm text-sale">
            {formError}
          </p>
        )}
        <Button type="submit" fullWidth size="lg" loading={busy} disabled={busy || quoting || blocked || !quote}>
          {quote ? `Pay securely` : 'Pay'}
        </Button>
        <p className="text-xs text-muted">Payments are processed by Razorpay. UPI, cards, netbanking and wallets accepted.</p>
      </form>
      <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start" aria-label="Order summary">
        <h2 className="text-lg font-medium">Order summary</h2>
        <CartLines lines={cart.lines} quote={quote} compact />
        <CouponForm couponCode={cart.couponCode} quote={quote} />
        <CartTotals quote={quote} />
      </aside>
    </div>
  );
}
