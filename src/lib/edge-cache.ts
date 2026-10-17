// WS-J: edge caching for Worker responses. Cloudflare Cache Rules never apply
// to a Worker on a custom domain, so custom-worker.mjs caches via the Cache
// API (caches.default). This module holds the pure decisions; it has no
// runtime imports so the worker entry can bundle it.

export const ADMIN_COOKIE = 'nowhence_admin';
export const CACHE_HEADER = 'x-nowhence-cache';
/** Cap for HTML at the edge: launch dates flip without an admin save. */
export const HTML_MAX_EDGE_TTL = 60;

const PRIVATE_PREFIXES = ['/admin', '/api', '/cart', '/checkout', '/orders', '/book', '/pay', '/_next/data'];

function underPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + '/');
}

function hasAdminCookie(cookie: string | null | undefined): boolean {
  if (!cookie) return false;
  return cookie.split(';').some((c) => c.trim().startsWith(ADMIN_COOKIE + '='));
}

export interface EdgeRequestInfo {
  method: string;
  url: string;
  cookie?: string | null;
  /** Next client-navigation headers (RSC payloads must not share an HTML key). */
  rsc?: boolean;
}

/** May this request be answered from / stored in the edge cache? */
export function isCacheableRequest(r: EdgeRequestInfo): boolean {
  if (r.method !== 'GET' && r.method !== 'HEAD') return false;
  if (r.rsc) return false;
  if (hasAdminCookie(r.cookie)) return false;
  let u: URL;
  try {
    u = new URL(r.url);
  } catch {
    return false;
  }
  if (PRIVATE_PREFIXES.some((p) => underPrefix(u.pathname, p))) return false;
  if (isMediaPath(u.pathname)) return true;
  // HTML: only the bare URL, so keys stay few and a purge hits them all.
  return u.search === '';
}

export function isMediaPath(path: string): boolean {
  return underPrefix(path, '/media');
}

export interface EdgeResponseInfo {
  status: number;
  cacheControl?: string | null;
  setCookie?: boolean;
}

function sMaxAge(cc: string): number | null {
  const m = /(?:^|,)\s*s-maxage=(\d+)/i.exec(cc);
  return m ? Number(m[1]) : null;
}

/**
 * Edge TTL in seconds for a response, or null to not store it. Media must be
 * marked immutable; HTML needs s-maxage (capped at HTML_MAX_EDGE_TTL).
 */
export function edgeTtl(path: string, r: EdgeResponseInfo): number | null {
  if (r.status !== 200 || r.setCookie) return null;
  const cc = r.cacheControl ?? '';
  if (/(?:^|,)\s*(private|no-store|no-cache)\b/i.test(cc)) return null;
  if (isMediaPath(path)) return /immutable/i.test(cc) ? 31536000 : null;
  const s = sMaxAge(cc);
  if (s == null || s <= 0) return null;
  return Math.min(s, HTML_MAX_EDGE_TTL);
}

/** Paths whose cached HTML an admin save/publish can change. */
export function purgePathsFor(opts: { productSlugs?: string[]; extra?: string[] } = {}): string[] {
  const base = ['/', '/shop', '/coming-soon'];
  const products = (opts.productSlugs ?? []).map((s) => `/products/${encodeURIComponent(s)}`);
  return [...new Set([...base, ...products, ...(opts.extra ?? [])])];
}
