import type { MetadataRoute } from 'next';
import { getSiteContent } from '@/lib/content';
import { isIndexable } from '@/lib/launches';
import { getStorefrontCatalogue } from '@/lib/launches-server';
import { absoluteUrl } from '@/lib/seo';
import { buildSitemap } from '@/lib/sitemap';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [catalogue, content] = await Promise.all([getStorefrontCatalogue(), getSiteContent()]);
  // A10: coming-soon pieces are never listed in the sitemap.
  const entries = buildSitemap({ ...catalogue, products: catalogue.products.filter(isIndexable) }, content);
  return [...entries, { url: absoluteUrl('/coming-soon'), changeFrequency: 'weekly', priority: 0.5 }];
}
