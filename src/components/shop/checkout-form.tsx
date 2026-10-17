'use client';
// S6 / A15: kept as the stable import path for the checkout page.
// The implementation lives in ./checkout/.

import { validateDetails, EMPTY_DETAILS } from '@/lib/commerce/checkout-details';
import { CheckoutView } from './checkout/CheckoutView';

export { LAST_ORDER_KEY } from './checkout/flow';

type Fields = Record<'email' | 'phone' | 'name' | 'line1' | 'line2' | 'city' | 'state' | 'pincode', string>;

/** Legacy flat-field validation (delegates to the A15 rules). */
export function validateFields(f: Fields): Partial<Record<keyof Fields, string>> {
  const e = validateDetails({
    ...EMPTY_DETAILS,
    email: f.email,
    phone: f.phone,
    ship: { name: f.name, line1: f.line1, line2: f.line2, city: f.city, state: f.state, pincode: f.pincode },
  });
  const out: Partial<Record<keyof Fields, string>> = {};
  for (const [k, v] of Object.entries(e)) out[k.replace(/^ship\./, '') as keyof Fields] = v;
  return out;
}

export function CheckoutForm() {
  return <CheckoutView />;
}
