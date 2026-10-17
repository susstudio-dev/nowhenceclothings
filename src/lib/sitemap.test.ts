import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CatalogueDoc } from './schemas/catalogue';
import { SiteContentDoc } from './schemas/site-content';
import { buildRobots, buildSitemap } from './sitemap';

const cat = CatalogueDoc.parse(JSON.parse(readFileSync('data/catalogue.json', 'utf8')));
const content = SiteContentDoc.parse(JSON.parse(readFileSync('data/site-content.json', 'utf8')));

describe('sitemap + robots', () => {
  it('lists canonical URLs for active products and static pages only', () => {
    const urls = buildSitemap(cat, content).map((e) => e.url);
    expect(urls.every((u) => u.startsWith('https://nowhenceclothings.com/'))).toBe(true);
    for (const p of cat.products.filter((x) => x.status === 'active')) {
      expect(urls).toContain(`https://nowhenceclothings.com/products/${p.slug}`);
    }
    expect(urls).toContain('https://nowhenceclothings.com/returns');
    expect(urls.some((u) => u.includes('/admin'))).toBe(false);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('disallows everything off the canonical host', () => {
    expect(buildRobots('nowhence.workers.dev').rules).toEqual({ userAgent: '*', disallow: '/' });
    const ok = buildRobots('nowhenceclothings.com');
    expect(ok.sitemap).toBe('https://nowhenceclothings.com/sitemap.xml');
    expect(JSON.stringify(ok.rules)).toContain('/admin');
  });
});
