import { describe, expect, it } from 'vitest';
import { buildRobots, buildSitemap, latestIso } from './sitemap';
import { content, publicProduct, storefront, variantsFor } from './__fixtures__/seo';
import { STATIC_SLUGS } from './static-pages';

const O = 'https://nowhenceclothings.com';

// The route passes the storefront projection; mirror that here.
const project = (...products: ReturnType<typeof publicProduct>[]) => storefront(products);

describe('buildSitemap', () => {
  const live = publicProduct();
  const presale = publicProduct({ id: 'p2', slug: 'polo-presale', variants: variantsFor('PRE'), availability: 'presale', presale: { enabled: true }, updatedAt: '2026-10-16T10:00:00.000Z' });
  const soon = publicProduct({ id: 'p3', slug: 'polo-secret', variants: variantsFor('SEC'), availability: 'coming_soon' });
  const draft = { ...publicProduct({ id: 'p4', slug: 'polo-draft', variants: variantsFor('DFT') }), status: 'draft' as const };
  const urls = (e: ReturnType<typeof buildSitemap>) => e.map((x) => x.url);

  it('lists the storefront, active and presale products, static pages and /coming-soon', () => {
    const u = urls(buildSitemap(project(live, presale), content()));
    expect(u).toEqual(expect.arrayContaining([`${O}/`, `${O}/shop`, `${O}/shop/tops`, `${O}/collections/core`, `${O}/coming-soon`]));
    expect(u).toContain(`${O}/products/polo-black`);
    expect(u).toContain(`${O}/products/polo-presale`);
    for (const s of STATIC_SLUGS) expect(u).toContain(`${O}/${s}`);
  });

  it('never lists hidden, coming-soon, draft or private URLs', () => {
    const u = urls(buildSitemap(project(live, soon, draft), content()));
    expect(u).not.toContain(`${O}/products/polo-secret`);
    expect(u).not.toContain(`${O}/products/polo-draft`);
    expect(u.some((x) => /\/(admin|api|cart|checkout|orders|book|pay|search)(\/|$)/.test(x))).toBe(false);
    expect(u.every((x) => x.startsWith(`${O}/`) && !x.includes('?'))).toBe(true);
    expect(new Set(u).size).toBe(u.length);
  });

  it('uses stored updatedAt for lastmod, never "now"', () => {
    const e = buildSitemap(project(live, presale), content({ updatedAt: '2026-10-10T00:00:00.000Z' }));
    const by = (path: string) => e.find((x) => x.url === `${O}${path}`)!;
    expect(by('/products/polo-black').lastModified).toBe('2026-10-15T09:30:00.000Z');
    expect(by('/products/polo-presale').lastModified).toBe('2026-10-16T10:00:00.000Z');
    // Listings follow their newest product; home also follows content publishes.
    expect(by('/shop').lastModified).toBe('2026-10-16T10:00:00.000Z');
    expect(by('/').lastModified).toBe('2026-10-16T10:00:00.000Z');
    expect(by('/shop/tops').lastModified).toBe('2026-10-16T10:00:00.000Z');
    // No stored date, no lastmod.
    expect(by('/faq')).not.toHaveProperty('lastModified');
    expect(by('/coming-soon')).not.toHaveProperty('lastModified');
  });

  it('uses the owner-entered legal dates and page edits', () => {
    const e = buildSitemap(project(live), content({ pages: { about: { slug: 'about', title: 'About', seo: {}, updatedAt: '2026-09-01T00:00:00.000Z' } } }), {
      legal: { privacyUpdatedAt: '2026-08-15', termsUpdatedAt: '' },
    });
    const by = (path: string) => e.find((x) => x.url === `${O}${path}`)!;
    expect(by('/about').lastModified).toBe('2026-09-01T00:00:00.000Z');
    expect(by('/privacy').lastModified).toBe('2026-08-15T00:00:00.000Z');
    expect(by('/terms')).not.toHaveProperty('lastModified');
  });

  it('adds image-sitemap entries for product photos only', () => {
    const e = buildSitemap(project(live), content());
    expect(e.find((x) => x.url === `${O}/products/polo-black`)!.images).toEqual([`${O}/media/m1/1600.webp`, `${O}/media/m2/1600.webp`]);
    expect(e.find((x) => x.url === `${O}/shop`)).not.toHaveProperty('images');
  });

  it('lists published, already-live journal and lookbook entries only', () => {
    const art = (slug: string, over: Record<string, unknown> = {}) => ({ slug, title: slug, seo: {}, blocks: [], excerpt: '', status: 'published', publishedAt: '2026-09-01T00:00:00.000Z', ...over });
    const c = content({
      journal: [art('live'), art('draft', { status: 'draft' }), art('later', { publishedAt: '2099-01-01T00:00:00.000Z' })],
    });
    const u = urls(buildSitemap(project(live), c, { now: new Date('2026-10-17T00:00:00.000Z') }));
    expect(u).toContain(`${O}/journal`);
    expect(u).toContain(`${O}/journal/live`);
    expect(u).not.toContain(`${O}/journal/draft`);
    expect(u).not.toContain(`${O}/journal/later`);
    expect(u).not.toContain(`${O}/lookbook`);
  });

  it('latestIso picks the newest valid date', () => {
    expect(latestIso(undefined, '2026-01-01T00:00:00.000Z', 'nope', '2026-03-01T00:00:00.000Z')).toBe('2026-03-01T00:00:00.000Z');
    expect(latestIso()).toBeUndefined();
  });
});

describe('buildRobots', () => {
  it('disallows everything off the canonical host', () => {
    expect(buildRobots('nowhence.workers.dev').rules).toEqual({ userAgent: '*', disallow: '/' });
    expect(buildRobots('www.nowhenceclothings.com').rules).toEqual({ userAgent: '*', disallow: '/' });
    expect(buildRobots(null).sitemap).toBeUndefined();
  });

  it('allows the storefront, blocks private areas and search permutations, names the sitemap', () => {
    const r = buildRobots('nowhenceclothings.com');
    expect(r.sitemap).toBe(`${O}/sitemap.xml`);
    const rule = r.rules as { userAgent: string; allow: string; disallow: string[] };
    expect(rule.allow).toBe('/');
    for (const p of ['/admin', '/api', '/cart', '/checkout', '/orders', '/book', '/pay', '/search', '/*?q=', '/*?*sort=']) {
      expect(rule.disallow).toContain(p);
    }
    expect(rule.disallow).not.toContain('/');
    expect(rule.disallow).not.toContain('/shop');
    expect(rule.disallow).not.toContain('/products');
    expect(rule.disallow).not.toContain('/media');
  });
});
