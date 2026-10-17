import type { MetadataRoute } from 'next';
import { isIndexable, type LaunchView } from './launches';
import type { CatalogueDoc, Product } from './schemas/catalogue';
import type { SettingsDoc } from './schemas/settings';
import type { SiteContentDoc } from './schemas/site-content';
import { PRIVATE_PATH_PREFIXES, FILTER_PARAMS, SITE_URL, absoluteUrl, isCanonicalHost, mediaUrl, paths } from './seo';
import { STATIC_SLUGS } from './static-pages';

// Pure builders behind app/sitemap.ts and app/robots.ts (WS-E).

type Entry = MetadataRoute.Sitemap[number];

/** Latest of the given ISO timestamps (ignoring blanks), or undefined. */
export function latestIso(...dates: (string | undefined)[]): string | undefined {
  let best: string | undefined;
  let bestMs = -Infinity;
  for (const d of dates) {
    const ms = d ? Date.parse(d) : NaN;
    if (Number.isFinite(ms) && ms > bestMs) {
      best = d;
      bestMs = ms;
    }
  }
  return best;
}

/** A product belongs in the sitemap when it is active and not a coming-soon piece. */
export function isSitemapProduct(p: Product & { launch?: LaunchView }): boolean {
  return p.status === 'active' && isIndexable(p);
}

/** Product image URLs for the image sitemap (sharp images only; blurred teasers never get here). */
export function productImageUrls(p: Product): string[] {
  return [...new Set(p.colours.flatMap((c) => c.images).map((m) => mediaUrl(m)))].slice(0, 10);
}

/**
 * `catalogue.products` should be the storefront projection; coming-soon and
 * non-active products are dropped here as well, so the rule cannot be bypassed.
 * `lastModified` comes from stored `updatedAt` values only: never from "now".
 */
export function buildSitemap(
  catalogue: CatalogueDoc,
  content: SiteContentDoc,
  opts: { legal?: Pick<SettingsDoc['legal'], 'privacyUpdatedAt' | 'termsUpdatedAt'>; now?: Date } = {},
): MetadataRoute.Sitemap {
  const products = catalogue.products.filter(isSitemapProduct);
  const lastOf = (list: Product[]) => latestIso(...list.map((p) => p.updatedAt));
  const entries: MetadataRoute.Sitemap = [];
  const push = (path: string, e: Omit<Entry, 'url'>) => {
    const url = absoluteUrl(path);
    if (!entries.some((x) => x.url === url)) entries.push({ url, ...e });
  };

  push(paths.home(), { lastModified: latestIso(content.updatedAt, lastOf(products)), changeFrequency: 'daily', priority: 1 });
  push(paths.shop(), { lastModified: lastOf(products), changeFrequency: 'daily', priority: 0.9 });
  for (const c of catalogue.categories) {
    push(paths.category(c.slug), { lastModified: lastOf(products.filter((p) => p.categoryId === c.id)), changeFrequency: 'weekly', priority: 0.8 });
  }
  for (const c of catalogue.collections) {
    push(paths.collection(c.slug), { lastModified: lastOf(products.filter((p) => p.collectionIds.includes(c.id))), changeFrequency: 'weekly', priority: 0.7 });
  }
  for (const d of catalogue.drops) {
    push(paths.drop(d.slug), { lastModified: lastOf(products.filter((p) => p.dropId === d.id)), changeFrequency: 'weekly', priority: 0.7 });
  }
  for (const p of products) {
    push(paths.product(p.slug), {
      lastModified: p.updatedAt,
      changeFrequency: 'weekly',
      priority: 0.8,
      images: productImageUrls(p),
    });
  }
  push('/coming-soon', { changeFrequency: 'weekly', priority: 0.5 });

  // Same rule as the pages: published and not scheduled for later.
  const now = (opts.now ?? new Date()).getTime();
  const live = (a: SiteContentDoc['journal'][number]) => a.status === 'published' && (!a.publishedAt || Date.parse(a.publishedAt) <= now);
  const lookbook = content.lookbook.filter(live);
  const journal = content.journal.filter(live);
  if (lookbook.length) push('/lookbook', { lastModified: latestIso(...lookbook.map((a) => a.updatedAt ?? a.publishedAt)), priority: 0.5 });
  for (const a of lookbook) push(paths.lookbook(a.slug), { lastModified: a.updatedAt ?? a.publishedAt, priority: 0.5 });
  if (journal.length) push('/journal', { lastModified: latestIso(...journal.map((a) => a.updatedAt ?? a.publishedAt)), priority: 0.5 });
  for (const a of journal) push(paths.journal(a.slug), { lastModified: a.updatedAt ?? a.publishedAt, priority: 0.5 });

  for (const s of STATIC_SLUGS) {
    // Stored dates only: legal pages use the owner-entered "last updated" day.
    const legalDay = s === 'privacy' ? opts.legal?.privacyUpdatedAt : s === 'terms' ? opts.legal?.termsUpdatedAt : undefined;
    const lastModified = latestIso(content.pages[s]?.updatedAt, legalDay ? `${legalDay}T00:00:00.000Z` : undefined);
    push(paths.page(s), { lastModified, changeFrequency: 'monthly', priority: 0.3 });
  }
  // Omit absent dates rather than emitting `lastmod: undefined`.
  return entries.map((e) => (e.lastModified ? e : (({ lastModified: _l, ...rest }) => rest)(e)));
}

/** Robots rules for the canonical host; every other host is disallowed entirely. */
export function buildRobots(host: string | null | undefined): MetadataRoute.Robots {
  if (!isCanonicalHost(host)) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        ...PRIVATE_PATH_PREFIXES.map((p) => `${p}`),
        // Filter / sort / search permutations of a listing: the canonical is the bare listing.
        ...FILTER_PARAMS.map((q) => `/*?*${q}=`),
        '/*?q=',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
