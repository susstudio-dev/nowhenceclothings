'use client';
// A15/A16: the one payment flow used by /checkout and the quick-buy sheet.
// Server prices everything; Razorpay opens as a modal over the current page.

import { useEffect, useState } from 'react';
import type { CheckoutResponse } from '@/lib/commerce/types';
import { EMPTY_DETAILS, detailsPayload, loadRemembered, saveRemembered, type CheckoutDetails } from '@/lib/commerce/checkout-details';
import { payWithRazorpay, type CheckoutOpts } from '../booking/pay';

export const LAST_ORDER_KEY = 'nowhence.lastOrder';

export class FlowError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

/** Details state seeded from this device after mount (no hydration mismatch). */
export function useCheckoutDetails() {
  const [details, setDetails] = useState<CheckoutDetails>(EMPTY_DETAILS);
  const [remembered, setRemembered] = useState(false);
  useEffect(() => {
    const r = loadRemembered();
    if (r) {
      setDetails(r);
      setRemembered(true);
    }
  }, []);
  return { details, setDetails, remembered };
}

export async function payForOrder(input: {
  lines: { sku: string; qty: number }[];
  couponCode?: string;
  presaleAccessCode?: string;
  details: CheckoutDetails;
}): Promise<{ result: 'paid' | 'dismissed'; number: string }> {
  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lines: input.lines,
      ...(input.couponCode ? { couponCode: input.couponCode } : {}),
      ...(input.presaleAccessCode ? { presaleAccessCode: input.presaleAccessCode } : {}),
      ...detailsPayload(input.details),
    }),
  });
  const json = (await res.json().catch(() => ({}))) as Partial<CheckoutResponse> & { error?: string; code?: string };
  if (!res.ok || !json.razorpay || !json.number) throw new FlowError(json.error || 'Checkout failed. Please try again.', json.code);
  saveRemembered(input.details);
  try {
    sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify({ number: json.number, email: input.details.email.trim().toLowerCase() }));
  } catch {
    /* storage blocked: confirmation falls back to tracking */
  }
  const result = await payWithRazorpay(json.razorpay as CheckoutOpts, `Order ${json.number}`);
  return { result, number: json.number };
}

export async function payDeposit(input: {
  slug: string;
  sku: string;
  qty: number;
  code?: string;
  details: CheckoutDetails;
}): Promise<{ result: 'paid' | 'dismissed'; token: string; number: string }> {
  const p = detailsPayload(input.details);
  const res = await fetch('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slug: input.slug,
      sku: input.sku,
      qty: input.qty,
      name: p.address?.name || input.details.ship.name.trim() || p.email,
      email: p.email,
      phone: p.phone,
      ...(input.code ? { code: input.code } : {}),
      ...(p.address ? { address: p.address } : {}),
      ...(p.billingAddress ? { billingAddress: p.billingAddress } : {}),
      ...(p.gstin ? { gstin: p.gstin } : {}),
      acceptPolicy: true,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string; code?: string; token?: string; number?: string; razorpay?: CheckoutOpts };
  if (!res.ok || !json.token || !json.razorpay || !json.number) throw new FlowError(json.error || 'Booking failed. Please retry.', json.code);
  saveRemembered(input.details);
  const result = await payWithRazorpay(json.razorpay, `Booking ${json.number} deposit`);
  return { result, token: json.token, number: json.number };
}
