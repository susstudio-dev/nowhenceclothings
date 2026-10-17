// A15: checkout details (contact, shipping, billing, GSTIN) shared by the
// checkout page, the quick-buy sheet and booking forms. Pure + client-safe;
// the server re-validates everything with the zod schemas.

import { validateGstin } from '@/lib/invoices/gst';

export interface AddressFields {
  name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
}

export interface CheckoutDetails {
  email: string;
  phone: string;
  ship: AddressFields;
  billingSame: boolean;
  bill: AddressFields;
  wantGst: boolean;
  gstin: string;
  /** Remember contact + address on this device. */
  remember: boolean;
}

export const EMPTY_ADDRESS: AddressFields = { name: '', line1: '', line2: '', city: '', state: '', pincode: '' };
export const EMPTY_DETAILS: CheckoutDetails = {
  email: '',
  phone: '',
  ship: EMPTY_ADDRESS,
  billingSame: true,
  bill: EMPTY_ADDRESS,
  wantGst: false,
  gstin: '',
  remember: true,
};

export type DetailErrors = Partial<Record<string, string>>;

/** "+91 98765-43210", "098765 43210" → "9876543210"; null if not an Indian mobile. */
export function normalisePhone(raw: string): string | null {
  let d = raw.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

/** Display as "98765 43210". */
export function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 10);
  return d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateAddress(a: AddressFields, prefix: string): DetailErrors {
  const e: DetailErrors = {};
  if (!a.name.trim()) e[`${prefix}.name`] = 'Enter the full name.';
  if (!a.line1.trim()) e[`${prefix}.line1`] = 'Enter the house number and street.';
  if (!/^[1-9]\d{5}$/.test(a.pincode.trim())) e[`${prefix}.pincode`] = 'Enter a 6-digit PIN code.';
  if (!a.city.trim()) e[`${prefix}.city`] = 'Enter the city.';
  if (!a.state.trim()) e[`${prefix}.state`] = 'Choose the state.';
  return e;
}

export function validateDetails(d: CheckoutDetails, opts: { requireAddress?: boolean } = {}): DetailErrors {
  const requireAddress = opts.requireAddress ?? true;
  const e: DetailErrors = {};
  if (!EMAIL_RE.test(d.email.trim())) e.email = 'Enter a valid email.';
  if (!normalisePhone(d.phone)) e.phone = 'Enter a 10-digit Indian mobile number.';
  if (requireAddress || hasAnyAddress(d.ship)) Object.assign(e, validateAddress(d.ship, 'ship'));
  else if (!d.ship.name.trim()) e['ship.name'] = 'Enter your full name.';
  if (!d.billingSame) Object.assign(e, validateAddress(d.bill, 'bill'));
  if (d.wantGst && d.gstin.trim()) {
    const g = validateGstin(d.gstin);
    if (!g.ok) e.gstin = g.error;
  } else if (d.wantGst) e.gstin = 'Enter your GSTIN, or untick the GST invoice option.';
  return e;
}

/** Anything beyond the name typed into the address (name doubles as the contact name). */
export const hasAnyAddress = (a: AddressFields) => [a.line1, a.line2, a.city, a.pincode].some((v) => v.trim());

const clean = (a: AddressFields) => ({
  name: a.name.trim(),
  line1: a.line1.trim(),
  line2: a.line2.trim(),
  city: a.city.trim(),
  state: a.state.trim(),
  pincode: a.pincode.trim(),
  country: 'IN' as const,
});

export interface DetailsPayload {
  email: string;
  phone: string;
  address?: ReturnType<typeof clean>;
  billingAddress?: ReturnType<typeof clean>;
  gstin?: string;
}

/** Request body fragment for /api/checkout and /api/bookings. Call after validateDetails passes. */
export function detailsPayload(d: CheckoutDetails): DetailsPayload {
  const ship = hasAnyAddress(d.ship) ? clean(d.ship) : undefined;
  return {
    email: d.email.trim().toLowerCase(),
    phone: normalisePhone(d.phone) ?? d.phone,
    ...(ship ? { address: ship } : {}),
    ...(!d.billingSame ? { billingAddress: clean(d.bill) } : {}),
    ...(d.wantGst && d.gstin.trim() ? { gstin: d.gstin.trim().toUpperCase() } : {}),
  };
}

// ---- remember on device ----------------------------------------------------------------

export const REMEMBER_KEY = 'nowhence.checkout.v1';

type Remembered = Omit<CheckoutDetails, 'remember'>;

export function serialiseRemembered(d: CheckoutDetails): string {
  const { remember: _r, ...rest } = d;
  return JSON.stringify(rest);
}

/** Tolerant parse: anything malformed yields null. */
export function parseRemembered(raw: string | null): Remembered | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<Remembered>;
    const addr = (a: unknown): AddressFields => {
      const o = (a && typeof a === 'object' ? a : {}) as Record<string, unknown>;
      const s = (k: keyof AddressFields) => (typeof o[k] === 'string' ? (o[k] as string).slice(0, 200) : '');
      return { name: s('name'), line1: s('line1'), line2: s('line2'), city: s('city'), state: s('state'), pincode: s('pincode') };
    };
    return {
      email: typeof v.email === 'string' ? v.email.slice(0, 200) : '',
      phone: typeof v.phone === 'string' ? v.phone.slice(0, 20) : '',
      ship: addr(v.ship),
      billingSame: v.billingSame !== false,
      bill: addr(v.bill),
      wantGst: v.wantGst === true,
      gstin: typeof v.gstin === 'string' ? v.gstin.slice(0, 15) : '',
    };
  } catch {
    return null;
  }
}

export function loadRemembered(): CheckoutDetails | null {
  try {
    const r = parseRemembered(localStorage.getItem(REMEMBER_KEY));
    return r ? { ...r, remember: true } : null;
  } catch {
    return null;
  }
}

export function saveRemembered(d: CheckoutDetails): void {
  try {
    if (d.remember) localStorage.setItem(REMEMBER_KEY, serialiseRemembered(d));
    else localStorage.removeItem(REMEMBER_KEY);
  } catch {
    /* storage blocked */
  }
}
