// Meta (Facebook) Pixel helpers. Pure and dependency-free so both the root
// layout (server) and storefront client components can import it.
//
// Rules (REQUIREMENTS A10 secrecy + owner brief):
// - Never on /admin: the server never renders the pixel there and track()
//   refuses to send from an admin path after a client-side navigation.
// - Money goes to Meta in rupees (number), converted from integer paise.
// - content_ids are the variant SKU when known, otherwise the product id.
// - Hidden titles / prices are never passed in (callers skip coming-soon).

/** The owner's pixel; Settings -> Marketing can change or clear it. */
export const DEFAULT_META_PIXEL_ID = '1574364723928175';
/** Pixel IDs are numeric (15-16 digits today); kept loose but digits-only so it is safe to inline. */
export const META_PIXEL_ID_RE = /^\d{6,20}$/;

export type MetaEvent = 'PageView' | 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase';

export interface MetaParams {
  content_ids?: string[];
  content_name?: string;
  content_type?: 'product';
  contents?: { id: string; quantity: number }[];
  num_items?: number;
  value?: number;
  currency?: 'INR';
}

export interface TrackOptions {
  /** Deduplication id (order / booking number for Purchase). */
  eventID?: string;
}

type Fbq = (...args: unknown[]) => void;
declare global {
  interface Window {
    fbq?: Fbq;
  }
}

/** A configured pixel id, or '' (disabled / invalid). */
export function normalisePixelId(v: unknown): string {
  if (typeof v !== 'string') return '';
  const id = v.trim();
  return META_PIXEL_ID_RE.test(id) ? id : '';
}

/** False for /admin and everything under it; the pixel never runs there. */
export function isTrackedPath(pathname: string | null | undefined): boolean {
  const p = pathname || '/';
  return !(p === '/admin' || p.startsWith('/admin/'));
}

/** The standard Meta bootstrap + init + first PageView, for an inline script. '' when the id is invalid. */
export function pixelBootstrap(pixelId: string): string {
  const id = normalisePixelId(pixelId);
  if (!id) return '';
  return (
    "!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?" +
    'n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;' +
    "n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;" +
    't.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}' +
    "(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');" +
    `fbq('init','${id}');fbq('track','PageView');`
  );
}

/** <noscript> image beacon URL. */
export function pixelNoscriptSrc(pixelId: string): string {
  return `https://www.facebook.com/tr?id=${encodeURIComponent(normalisePixelId(pixelId))}&ev=PageView&noscript=1`;
}

/** Integer paise -> rupees as a number (Meta wants a decimal amount). */
export function paiseToRupees(paise: number): number {
  if (!Number.isFinite(paise)) return 0;
  return Math.round(paise) / 100;
}

/** Variant SKU when known, otherwise the product id. */
export function contentId(item: { sku?: string; productId?: string }): string | undefined {
  return item.sku || item.productId || undefined;
}

const money = (paise: number | undefined): Pick<MetaParams, 'value' | 'currency'> =>
  typeof paise === 'number' && Number.isFinite(paise) && paise >= 0 ? { value: paiseToRupees(paise), currency: 'INR' } : {};

/** ViewContent on a product page (product id; no variant chosen yet). */
export function viewContentParams(p: { productId: string; title: string; price?: number }): MetaParams {
  return { content_ids: [p.productId], content_name: p.title, content_type: 'product', ...money(p.price) };
}

/** AddToCart for one bag line. `unitPrice` is the display snapshot in paise. */
export function addToCartParams(line: { sku: string; productId?: string; title?: string; qty: number; unitPrice?: number }): MetaParams {
  const id = contentId(line)!;
  const qty = Math.max(1, Math.floor(line.qty));
  return {
    content_ids: [id],
    ...(line.title ? { content_name: line.title } : {}),
    content_type: 'product',
    contents: [{ id, quantity: qty }],
    num_items: qty,
    ...money(typeof line.unitPrice === 'number' ? line.unitPrice * qty : undefined),
  };
}

/** InitiateCheckout / Purchase payload for a set of items and an amount in paise. */
export function checkoutParams(items: { sku?: string; productId?: string; qty: number }[], amountPaise?: number): MetaParams {
  const contents = items
    .map((i) => ({ id: contentId(i), quantity: Math.max(1, Math.floor(i.qty)) }))
    .filter((c): c is { id: string; quantity: number } => !!c.id);
  return {
    content_ids: [...new Set(contents.map((c) => c.id))],
    content_type: 'product',
    contents,
    num_items: contents.reduce((n, c) => n + c.quantity, 0),
    ...money(amountPaise),
  };
}

/** Purchase eventID for a booking balance (the deposit Purchase already used the booking number). */
export function balanceEventId(bookingNumber: string): string {
  return `${bookingNumber}-balance`;
}

/** Order statuses that mean the payment was confirmed server-side and kept (not refunded). */
const PAID_STATUSES = new Set(['paid', 'packed', 'shipped', 'delivered', 'exchange_requested']);
export function isPaidStatus(status: string | undefined): boolean {
  return !!status && PAID_STATUSES.has(status);
}

// Events fired before the inline bootstrap runs (child effects run before the
// layout's) wait here; flushPending() sends them once fbq exists. Bounded and
// in memory only: when the pixel is disabled or blocked they are simply dropped.
const MAX_PENDING = 20;
const pending: [MetaEvent, MetaParams | undefined, TrackOptions | undefined][] = [];

function currentPath(): string {
  try {
    return window.location.pathname;
  } catch {
    return '/';
  }
}

function send(fbq: Fbq, event: MetaEvent, params?: MetaParams, opts?: TrackOptions) {
  const extra = opts?.eventID ? [{ eventID: opts.eventID }] : [];
  try {
    if (params) fbq('track', event, params, ...extra);
    else fbq('track', event, ...(extra.length ? [{}, ...extra] : []));
  } catch {
    /* never let analytics break the page */
  }
}

/**
 * Send a standard event. Safe everywhere: returns false (and sends nothing)
 * on the server, on /admin paths, or while fbq is absent.
 */
export function track(event: MetaEvent, params?: MetaParams, opts?: TrackOptions): boolean {
  if (typeof window === 'undefined') return false;
  if (!isTrackedPath(currentPath())) return false;
  const fbq = window.fbq;
  if (typeof fbq !== 'function') {
    if (pending.length < MAX_PENDING) pending.push([event, params, opts]);
    return false;
  }
  send(fbq, event, params, opts);
  return true;
}

/** Send events queued before the pixel bootstrapped. Returns how many went out. */
export function flushPending(): number {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function' || !isTrackedPath(currentPath())) return 0;
  const fbq = window.fbq;
  const batch = pending.splice(0, pending.length);
  for (const [e, p, o] of batch) send(fbq, e, p, o);
  return batch.length;
}

/** Test hook. */
export function _resetPending() {
  pending.length = 0;
}

export const SENT_KEY_PREFIX = 'nowhence.meta.sent.';
const sentInMemory = new Set<string>();

/** sessionStorage key marking an event as already sent for this order / booking. */
export function sentKey(event: MetaEvent, key: string): string {
  return `${SENT_KEY_PREFIX}${event}.${key}`;
}

/**
 * Fire at most once per browser session for `key` (e.g. order number), so a
 * confirmation-page reload does not double-count. Falls back to memory when
 * sessionStorage is blocked. Returns true when this call claimed the event.
 */
export function trackOnce(key: string, event: MetaEvent, params?: MetaParams, opts?: TrackOptions): boolean {
  if (typeof window === 'undefined' || !key) return false;
  if (!isTrackedPath(currentPath())) return false;
  const k = sentKey(event, key);
  if (sentInMemory.has(k)) return false;
  try {
    if (window.sessionStorage.getItem(k)) return false;
    window.sessionStorage.setItem(k, '1');
  } catch {
    /* storage blocked: memory guard only */
  }
  sentInMemory.add(k);
  track(event, params, opts);
  return true;
}

/** Test hook. */
export function _resetSent() {
  sentInMemory.clear();
}
