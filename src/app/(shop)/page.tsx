import type { Metadata } from 'next';
import { BlockRenderer } from '@/components/shop/BlockRenderer';
import { ComingSoonSection } from '@/components/shop/ComingSoonGrid';
import { HomeEditorial } from '@/components/shop/HomeEditorial';
import { PresaleHero, PresaleNote } from '@/components/shop/PresaleHero';
import { StitchHero } from '@/components/shop/StitchHero';
import { heroPresaleProduct } from '@/components/shop/quick-buy';
import { getCatalogue, getInventory } from '@/lib/catalogue';
import { getSettings, getSiteContent } from '@/lib/content';
import { productsFor, publicDrops } from '@/lib/launches-server';
import { DEFAULT_HERO_MEDIA, isPlaceholderMedia } from '@/lib/brand-defaults';
import { DEFAULT_DESCRIPTION, buildMetadata, paths } from '@/lib/seo';
import { motifFor, pickStitchProduct } from '@/lib/stitch-hero';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { home } = await getSiteContent();
  return buildMetadata({
    title: 'Nowhence | Polos for after the match, embroidered in India',
    exactTitle: true,
    path: paths.home(),
    seo: home.seo,
    description: DEFAULT_DESCRIPTION,
  });
}

const isPlaceholderCopy = (s: string) => /placeholder/i.test(s);

/**
 * Home (S1, A16): the stitch hero leads, drawing the lead polo as it is embroidered and sewn: the open presale /
 * pre-booking piece (bought in place) or else the first polo with a known motif. A presale piece without a motif
 * keeps the photo hero; with no lead piece the editorial hero from site content leads. Then content blocks and
 * the A10 "Coming soon" section.
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
  // The stitch hero draws a polo whose embroidery we know; only pieces shown in full (never a coming-soon teaser).
  const stitch = pickStitchProduct(
    featured,
    products.filter((p) => p.launch.state === 'available' && p.colours.length),
  );
  const stitchMotif = stitch && motifFor(stitch);
  const leads = Boolean(featured || stitchMotif);

  const blocks = content.home.blocks
    // A12: a hero still on the placeholder image falls back to the bundled black polo photo.
    .map((b) => (b.type === 'hero' && isPlaceholderMedia(b.media) ? { ...b, media: DEFAULT_HERO_MEDIA } : b))
    // The footer already carries the newsletter; unfinished story copy never ships.
    .filter((b) => b.type !== 'newsletter' && !(b.type === 'story' && isPlaceholderCopy(b.body)));
  // The stitch hero (or the presale photo) takes the lead slot; the editorial hero's words and image move to the brand moment below it.
  const hero = blocks.find((b) => b.type === 'hero');
  const ordered = leads ? blocks.filter((b) => b.type !== 'hero') : blocks;
  const editorial = leads && hero?.type === 'hero' && hero.heading.trim() ? hero : undefined;
  // Sections above bring their own bottom padding, except a full-bleed hero or the pre-order strip.
  const soonSpacing = leads && (editorial || ordered.length) ? undefined : 'pt-section';

  return (
    <>
      {leads && (
        <>
          {stitch && stitchMotif ? <StitchHero product={stitch} motif={stitchMotif} /> : featured && <PresaleHero product={featured} />}
          {featured && <PresaleNote product={featured} />}
          {editorial && <HomeEditorial heading={editorial.heading} body={editorial.subheading} media={editorial.media} cta={editorial.cta} />}
        </>
      )}
      <BlockRenderer blocks={ordered} ctx={{ catalogue, inventory }} firstIsHero={!leads} />
      {/* Last on the page: the footer's own top margin is the gap, so no bottom padding here. */}
      <ComingSoonSection heading={d.home.heading} products={soon} className={soonSpacing} />
      {products.length === 0 && soon.length === 0 && (
        <section className="container-page py-section text-center">
          <p className="eyebrow">Nowhence</p>
          <h2 className="mx-auto mt-4 max-w-xl text-balance font-display text-display-sm font-light">The first drop is almost here.</h2>
          <p className="mx-auto mt-4 max-w-sm text-small text-muted">Polos for after the match, embroidered in India in small runs. Join the list below to hear first.</p>
        </section>
      )}
    </>
  );
}
