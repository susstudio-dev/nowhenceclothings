import type { Metadata } from 'next';
import { BlockRenderer } from '@/components/shop/BlockRenderer';
import { ComingSoonSection } from '@/components/shop/ComingSoonGrid';
import { getCatalogue, getInventory } from '@/lib/catalogue';
import { getSettings, getSiteContent } from '@/lib/content';
import { productsFor, publicDrops } from '@/lib/launches-server';
import { DEFAULT_HERO_MEDIA, isPlaceholderMedia } from '@/lib/brand-defaults';
import { DEFAULT_DESCRIPTION } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { home } = await getSiteContent();
  return { title: { absolute: home.seo.title ?? 'Nowhence — premium unisex clothing' }, description: home.seo.description?.trim() || DEFAULT_DESCRIPTION };
}

/** Home (S1): driven by site-content `home.blocks`, plus the A10 "Coming soon" section from Settings → Launches. */
export default async function HomePage() {
  const [content, raw, inventory, settings] = await Promise.all([getSiteContent(), getCatalogue(), getInventory(), getSettings()]);
  const d = settings.launches;
  const now = new Date();
  // Only projected products reach rendering (A10 secrecy).
  const catalogue = { ...raw, drops: publicDrops(raw.drops), products: productsFor(raw, d, 'shop', now) };
  const soon = d.home.enabled ? productsFor(raw, d, 'home', now).slice(0, d.home.limit) : [];
  // A12: a hero still on the placeholder image falls back to the bundled black polo photo.
  const blocks = content.home.blocks.map((b) => (b.type === 'hero' && isPlaceholderMedia(b.media) ? { ...b, media: DEFAULT_HERO_MEDIA } : b));
  return (
    <>
      <BlockRenderer blocks={blocks} ctx={{ catalogue, inventory }} />
      <ComingSoonSection heading={d.home.heading} products={soon} inventory={inventory} drops={publicDrops(raw.drops)} />
      {catalogue.products.length === 0 && soon.length === 0 && (
        <section className="mx-auto max-w-3xl px-4 py-24 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-muted">Nowhence</p>
          <h2 className="mt-4 font-display text-3xl md:text-4xl">The first drop is almost here.</h2>
          <p className="mt-4 text-muted">Considered unisex essentials, made in small runs. Join the list below to hear first.</p>
        </section>
      )}
    </>
  );
}
