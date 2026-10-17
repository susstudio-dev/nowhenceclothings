import type { Metadata } from 'next';
import { BlockRenderer } from '@/components/shop/BlockRenderer';
import { ComingSoonSection } from '@/components/shop/ComingSoonGrid';
import { getCatalogue, getInventory } from '@/lib/catalogue';
import { getSettings, getSiteContent } from '@/lib/content';
import { productsFor, publicDrops } from '@/lib/launches-server';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { home } = await getSiteContent();
  return { title: { absolute: home.seo.title ?? 'Nowhence — premium unisex clothing' }, description: home.seo.description };
}

/** Home (S1): driven by site-content `home.blocks`, plus the A10 "Coming soon" section from Settings → Launches. */
export default async function HomePage() {
  const [content, raw, inventory, settings] = await Promise.all([getSiteContent(), getCatalogue(), getInventory(), getSettings()]);
  const d = settings.launches;
  const now = new Date();
  // Only projected products reach rendering (A10 secrecy).
  const catalogue = { ...raw, drops: publicDrops(raw.drops), products: productsFor(raw, d, 'shop', now) };
  const soon = d.home.enabled ? productsFor(raw, d, 'home', now).slice(0, d.home.limit) : [];
  return (
    <>
      <BlockRenderer blocks={content.home.blocks} ctx={{ catalogue, inventory }} />
      <ComingSoonSection heading={d.home.heading} products={soon} inventory={inventory} drops={publicDrops(raw.drops)} />
    </>
  );
}
