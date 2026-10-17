import type { MetadataRoute } from 'next';
import { getSettings, getSiteContent } from '@/lib/content';
import { getStorefrontCatalogue } from '@/lib/launches-server';
import { buildSitemap } from '@/lib/sitemap';

export const dynamic = 'force-dynamic';

// Reads the storefront projection, so hidden / coming-soon pieces never appear
// (A10); buildSitemap also drops them itself. Draft and archived products are
// not in the projection at all.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [catalogue, content, settings] = await Promise.all([getStorefrontCatalogue(), getSiteContent(), getSettings()]);
  return buildSitemap(catalogue, content, { legal: settings.legal });
}
