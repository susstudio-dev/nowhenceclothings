import type { SettingsDoc } from './schemas/settings';
import { formatPaise } from './money';

// Customer-facing lines derived from store settings: shipping and contact.
// Pure; every sentence says exactly what checkout (commerce/pricing.ts) does.

type Shipping = Pick<SettingsDoc['shipping'], 'flatFee' | 'freeShippingThreshold'>;

/** Upper-case the first letter: owner-typed "ships in 5 days" opens a sentence. */
export function sentenceCase(s: string): string {
  const t = s.trim();
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

/** Delivery estimate as a sentence without its final full stop ("Ships in 5–6 working days"). */
export function etaSentence(eta: string): string {
  return sentenceCase(eta).replace(/\.+$/, '');
}

/**
 * One line for shipping cost.
 * - fee 0 -> free on every order
 * - no threshold (0) -> "Flat ₹99 shipping on every order."
 * - threshold above the fee -> "Flat ₹99 shipping. Free on orders of ₹2,999 or more."
 * - threshold at or below the fee (a likely swapped setting) -> only the free rule,
 *   because that is what checkout applies to every real order.
 */
export function shippingSummary(s: Shipping): string {
  if (s.flatFee <= 0) return 'Free shipping on every order.';
  if (s.freeShippingThreshold <= 0) return `Flat ${formatPaise(s.flatFee)} shipping on every order.`;
  if (s.freeShippingThreshold <= s.flatFee) return `Free shipping on orders of ${formatPaise(s.freeShippingThreshold)} or more.`;
  return `Flat ${formatPaise(s.flatFee)} shipping. Free on orders of ${formatPaise(s.freeShippingThreshold)} or more.`;
}

/** Admin warning: a free-shipping threshold at or below the fee is almost always the two fields swapped. */
export function shippingLooksSwapped(s: Shipping): boolean {
  return s.flatFee > 0 && s.freeShippingThreshold > 0 && s.freeShippingThreshold <= s.flatFee;
}

/** Indian mobile as E.164 digits without '+': "9014352958" -> "919014352958". '' when unusable. */
export function phoneDigits(phone: string | undefined): string {
  let d = (phone ?? '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) d = `91${d}`;
  return d.length >= 11 && d.length <= 15 ? d : '';
}

/** "+91 90143 52958" for Indian numbers, "+<digits>" otherwise; '' when unusable. */
export function displayPhone(phone: string | undefined): string {
  const d = phoneDigits(phone);
  if (!d) return '';
  if (d.length === 12 && d.startsWith('91')) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
  return `+${d}`;
}

/** WhatsApp click-to-chat link, optionally with a prefilled message. */
export function whatsappUrl(phone: string | undefined, text?: string): string | undefined {
  const d = phoneDigits(phone);
  if (!d) return undefined;
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

/** "@handle" from a handle or profile URL; '' when unusable. */
export function instagramHandle(value: string | undefined): string {
  const v = (value ?? '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(v) ? `@${v}` : '';
}
