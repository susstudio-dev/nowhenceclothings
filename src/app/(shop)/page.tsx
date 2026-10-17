import type { Metadata } from 'next';
import { BlockRenderer } from '@/components/shop/BlockRenderer';
import { ComingSoonSection } from '@/components/shop/ComingSoonGrid';
import { PresaleHero } from '@/components/shop/PresaleHero';
import { heroPresaleProduct } from '@/components/shop/quick-buy';
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

const isPlaceholderCopy = (s: string) => /placeholder/i.test(s);

/**
 * Home (S1, A16): when a presale / pre-booking piece is open it leads the page and can be bought in place;
 * otherwise the editorial hero from site content leads. Then content blocks and the A10 "Coming soon" section.
 */
export default async function HomePage() {
  const [content, raw, inventory, settings] = await Promise.all([getSiteContent(), getCatalogue(), getInventory(), getSettings()]);
  const d = settings.launches;
  const now = new Date();
  // Only projected products reach rendering (A10 secrecy).
  const products = productsFor(raw, d, 'shop', now);
  const catalogue = { ...raw, drops: publicDrops(raw.drops), products };
  const soon = d.home.enabled ? productsFor(raw, d, 'home', now).slice(0, d.home.limit) : [];
  const featured = heroPresaleProduct(products);

  const blocks = content.home.blocks
    // A12: a hero still on the placeholder image falls back to the bundled black polo photo.
    .map((b) => (b.type === 'hero' && isPlaceholderMedia(b.media) ? { ...b, media: DEFAULT_HERO_MEDIA } : b))
    // The footer already carries the newsletter; unfinished story copy never ships.
    .filter((b) => b.type !== 'newsletter' && !(b.type === 'story' && isPlaceholderCopy(b.body)));
  // The presale piece takes the lead slot in place of the editorial hero.
  const ordered = featured ? blocks.filter((b) => b.type !== 'hero') : blocks;

  return (
    <>
      {featured && <PresaleHero product={featured} inventory={inventory} />}
      <BlockRenderer blocks={ordered} ctx={{ catalogue, inventory }} firstIsHero={!featured} />
      <ComingSoonSection heading={d.home.heading} products={soon} inventory={inventory} drops={catalogue.drops} />
      {products.length === 0 && soon.length === 0 && (
        <section className="container-page py-section text-center">
          <p className="eyebrow">Nowhence</p>
          <h2 className="mx-auto mt-4 max-w-xl text-balance font-display text-display-sm font-light">The first drop is almost here.</h2>
          <p className="mx-auto mt-4 max-w-sm text-small text-muted">Considered unisex essentials, made in small runs. Join the list below to hear first.</p>
        </section>
      )}
    </>
  );
}
