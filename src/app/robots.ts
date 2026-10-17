import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { buildRobots } from '@/lib/sitemap';

export const dynamic = 'force-dynamic';

// Only nowhenceclothings.com is crawlable; any other host (workers.dev,
// previews, www) gets a disallow-all robots.txt.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  return buildRobots(h.get('x-forwarded-host') ?? h.get('host'));
}
