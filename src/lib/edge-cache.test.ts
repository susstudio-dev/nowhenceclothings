import { describe, expect, it } from 'vitest';
import { HTML_MAX_EDGE_TTL, edgeTtl, isCacheableRequest, purgePathsFor, withoutInternalHeaders } from './edge-cache';
import { purgeEdge } from './edge-purge';

const req = (url: string, extra: Partial<Parameters<typeof isCacheableRequest>[0]> = {}) =>
  isCacheableRequest({ method: 'GET', url: `https://nowhenceclothings.com${url}`, ...extra });

describe('isCacheableRequest', () => {
  it('public pages yes', () => {
    expect(req('/')).toBe(true);
    expect(req('/shop')).toBe(true);
    expect(req('/products/x')).toBe(true);
    expect(req('/media/a/480.webp?v=1')).toBe(true);
  });
  it('private paths, admins, queries, RSC and writes no', () => {
    for (const p of ['/admin', '/admin/x', '/api/quote', '/cart', '/checkout/ok', '/orders/track', '/book', '/pay/x']) expect(req(p)).toBe(false);
    expect(req('/', { cookie: 'a=1; nowhence_admin=tok' })).toBe(false);
    expect(req('/', { cookie: 'not_nowhence_admin=1' })).toBe(true);
    expect(req('/shop?_rsc=1')).toBe(false);
    expect(req('/', { rsc: true })).toBe(false);
    expect(req('/', { method: 'POST' })).toBe(false);
    expect(req('/', { method: 'HEAD' })).toBe(true);
    expect(req('/administrator')).toBe(true);
  });
});

describe('edgeTtl', () => {
  it('html needs s-maxage, capped', () => {
    expect(edgeTtl('/', { status: 200, cacheControl: 'public, max-age=0, s-maxage=300' })).toBe(HTML_MAX_EDGE_TTL);
    expect(edgeTtl('/', { status: 200, cacheControl: 'public, s-maxage=30' })).toBe(30);
    expect(edgeTtl('/', { status: 200, cacheControl: 'public, max-age=60' })).toBeNull();
    expect(edgeTtl('/', { status: 200, cacheControl: 'private, s-maxage=60' })).toBeNull();
    expect(edgeTtl('/', { status: 404, cacheControl: 's-maxage=60' })).toBeNull();
    expect(edgeTtl('/', { status: 200, cacheControl: 's-maxage=60', setCookie: true })).toBeNull();
  });
  it('media only when immutable', () => {
    expect(edgeTtl('/media/a/1.webp', { status: 200, cacheControl: 'public, max-age=31536000, immutable' })).toBe(31536000);
    expect(edgeTtl('/media/a/1.webp', { status: 200, cacheControl: 'public, max-age=60' })).toBeNull();
  });
});

describe('purge', () => {
  it('paths include base and products', () => {
    expect(purgePathsFor({ productSlugs: ['polo a'] })).toEqual(['/', '/shop', '/coming-soon', '/products/polo%20a']);
  });
  it('deletes each origin x path; no cache = no-op', async () => {
    const seen: string[] = [];
    const n = await purgeEdge({ origins: ['https://x.test'] }, { delete: async (r) => (seen.push(typeof r === 'string' ? r : r.url), true) });
    expect(n).toBe(3);
    expect(seen).toContain('https://x.test/coming-soon');
    expect(await purgeEdge({}, null)).toBe(0);
  });
});

describe('withoutInternalHeaders', () => {
  it('strips a client-sent x-admin-path (would hide the Meta Pixel on a cached public page)', () => {
    const h = new Headers({ 'x-admin-path': '/admin', accept: 'text/html' });
    const out = withoutInternalHeaders(h)!;
    expect(out.has('x-admin-path')).toBe(false);
    expect(out.get('accept')).toBe('text/html');
    expect(h.has('x-admin-path')).toBe(true); // input untouched
  });

  it('returns null when there is nothing to strip', () => {
    expect(withoutInternalHeaders(new Headers({ accept: 'text/html' }))).toBeNull();
  });
});
