import type { MetadataRoute } from 'next';
import { getCatalogue } from '@/lib/catalogue';
import { getSiteContent } from '@/lib/content';
import { buildSitemap } from '@/lib/sitemap';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [catalogue, content] = await Promise.all([getCatalogue(), getSiteContent()]);
  return buildSitemap(catalogue, content);
}
