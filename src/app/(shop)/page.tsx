import type { Metadata } from 'next';
import { BlockRenderer } from '@/components/shop/BlockRenderer';
import { getCatalogue, getInventory } from '@/lib/catalogue';
import { getSiteContent } from '@/lib/content';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { home } = await getSiteContent();
  return { title: { absolute: home.seo.title ?? 'Nowhence — premium unisex clothing' }, description: home.seo.description };
}

/** Home (S1): entirely driven by site-content `home.blocks`. */
export default async function HomePage() {
  const [content, catalogue, inventory] = await Promise.all([getSiteContent(), getCatalogue(), getInventory()]);
  return <BlockRenderer blocks={content.home.blocks} ctx={{ catalogue, inventory }} />;
}
