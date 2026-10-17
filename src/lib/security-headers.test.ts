import { describe, expect, it } from 'vitest';
// @ts-expect-error -- untyped .mjs config
import nextConfig from '../../next.config.mjs';

type Rule = { source: string; headers: { key: string; value: string }[]; missing?: unknown[] };

describe('security + cache headers (next.config.mjs)', async () => {
  const rules = (await nextConfig.headers()) as Rule[];
  const header = (source: string, key: string) =>
    rules
      .filter((r) => r.source === source && !r.missing)
      .flatMap((r) => r.headers)
      .filter((h) => h.key === key)
      .at(-1)?.value;

  it('sets a locked-down CSP and HSTS site-wide', () => {
    const csp = header('/:path*', 'Content-Security-Policy')!;
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain('https://checkout.razorpay.com');
    expect(csp).not.toContain('unsafe-eval');
    expect(header('/:path*', 'Strict-Transport-Security')).toMatch(/max-age=\d+/);
  });

  it('allows the Meta Pixel and nothing broader', () => {
    const csp = header('/:path*', 'Content-Security-Policy')!;
    const dir = (name: string) => csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(name + ' '))!;
    expect(dir('script-src').split(' ')).toContain('https://connect.facebook.net');
    expect(dir('connect-src').split(' ')).toEqual(
      expect.arrayContaining(["'self'", 'https://www.facebook.com', 'https://connect.facebook.net', 'https://api.razorpay.com']),
    );
    // The noscript / fallback beacon is an <img> to www.facebook.com/tr.
    expect(dir('img-src').split(' ')).toContain('https:');
    // Unchanged: no Meta frames, no wildcard scripts.
    expect(dir('frame-src')).toBe('frame-src https://api.razorpay.com https://checkout.razorpay.com https://www.facebook.com');
    expect(dir('script-src')).not.toMatch(/\*|https:(\s|$)/);
    expect(dir('default-src')).toBe("default-src 'self'");
  });

  it('never caches or indexes admin, api, checkout, orders', () => {
    for (const s of ['/admin/:path*', '/api/:path*', '/checkout', '/orders/:path*']) {
      expect(header(s, 'Cache-Control')).toBe('no-store, private');
      expect(header(s, 'X-Robots-Tag')).toContain('noindex');
    }
  });

  it('edge-caches public pages only, never for admin sessions', () => {
    const pub = rules.find((r) => r.headers.some((h) => h.value.includes('s-maxage')))!;
    const re = new RegExp(`^${pub.source}$`);
    expect(re.test('/products/tee')).toBe(true);
    expect(re.test('/adminfoo')).toBe(true);
    expect(re.test('/admin/orders')).toBe(false);
    expect(re.test('/api/checkout')).toBe(false);
    expect(re.test('/checkout')).toBe(false);
    expect(JSON.stringify(pub.missing)).toContain('nowhence_admin');
  });

  it('noindexes non-canonical hosts', () => {
    const r = rules.find((x) => JSON.stringify(x.missing ?? []).includes('"host"'))!;
    expect(r.headers).toContainEqual({ key: 'X-Robots-Tag', value: 'noindex, nofollow' });
  });
});
