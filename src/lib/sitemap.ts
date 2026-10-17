import type { MetadataRoute } from 'next';
import type { CatalogueDoc } from './schemas/catalogue';
import type { SiteContentDoc } from './schemas/site-content';
import { PRIVATE_PATH_PREFIXES, SITE_URL, absoluteUrl, isCanonicalHost, paths } from './seo';
import { STATIC_SLUGS } from './static-pages';

// Pure builders behind app/sitemap.ts and app/robots.ts (WS-E).

export function buildSitemap(catalogue: CatalogueDoc, content: SiteContentDoc): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [
    { url: absoluteUrl(paths.home()), changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl(paths.shop()), changeFrequency: 'daily', priority: 0.9 },
  ];
  for (const c of catalogue.categories) entries.push({ url: absoluteUrl(paths.category(c.slug)), changeFrequency: 'weekly', priority: 0.8 });
  for (const c of catalogue.collections) entries.push({ url: absoluteUrl(paths.collection(c.slug)), changeFrequency: 'weekly', priority: 0.7 });
  for (const d of catalogue.drops) entries.push({ url: absoluteUrl(paths.drop(d.slug)), changeFrequency: 'weekly', priority: 0.7 });
  for (const p of catalogue.products) {
    if (p.status !== 'active') continue;
    entries.push({ url: absoluteUrl(paths.product(p.slug)), lastModified: p.updatedAt, changeFrequency: 'weekly', priority: 0.8 });
  }
  for (const a of content.lookbook) {
    if (a.status === 'published') entries.push({ url: absoluteUrl(paths.lookbook(a.slug)), lastModified: a.updatedAt ?? a.publishedAt, priority: 0.5 });
  }
  for (const a of content.journal) {
    if (a.status === 'published') entries.push({ url: absoluteUrl(paths.journal(a.slug)), lastModified: a.updatedAt ?? a.publishedAt, priority: 0.5 });
  }
  for (const s of STATIC_SLUGS) entries.push({ url: absoluteUrl(paths.page(s)), changeFrequency: 'monthly', priority: 0.3 });
  return entries;
}

export function buildRobots(host: string | null | undefined): MetadataRoute.Robots {
  if (!isCanonicalHost(host)) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/', disallow: PRIVATE_PATH_PREFIXES.map((p) => `${p}`) },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
