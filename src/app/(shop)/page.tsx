import type { Metadata } from 'next';
import { BlockRenderer } from '@/components/shop/BlockRenderer';
import { ComingSoonSection } from '@/components/shop/ComingSoonGrid';
import { HomeEditorial } from '@/components/shop/HomeEditorial';
import { NightHero } from '@/components/shop/NightHero';
import { PresaleHero, PresaleNote } from '@/components/shop/PresaleHero';
import { StitchHero } from '@/components/shop/StitchHero';
import { heroPresaleProduct } from '@/components/shop/quick-buy';
import { getCatalogue, getInventory } from '@/lib/catalogue';
import { getSettings, getSiteContent } from '@/lib/content';
import { productsFor, publicDrops } from '@/lib/launches-server';
import { DEFAULT_HERO_MEDIA, isPlaceholderMedia } from '@/lib/brand-defaults';
import { DEFAULT_DESCRIPTION, buildMetadata, paths, plainText } from '@/lib/seo';
import { nightHeroFor } from '@/lib/night-hero';
import { motifFor, pickStitchProduct } from '@/lib/stitch-hero';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { home } = await getSiteContent();
  return buildMetadata({
    title: 'Nowhence | Embroidered polos for after the match',
    exactTitle: true,
    path: paths.home(),
    seo: home.seo,
    description: DEFAULT_DESCRIPTION,
  });
}

const isPlaceholderCopy = (s: string) => /placeholder/i.test(s);

/**
 * Home (S1, A16): the lead polo leads: the open presale / pre-booking piece (bought in place) or else the first polo
 * with a known motif. A motif with prepared photographs gets the night hero (its real embroidery stitched into the
 * real cloth); any other motif gets the stitch hero, drawing the polo as it is embroidered and sewn. A presale piece
 * without a motif keeps the photo hero; with no lead piece the editorial hero from site content leads. Then content
 * blocks and the A10 "Coming soon" section.
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
  // A motif whose photographs have been prepared leads in the night hero; the others keep the drawn stitch hero.
  const night = nightHeroFor(stitchMotif || undefined);
  const leads = Boolean(featured || stitchMotif);

  const blocks = content.home.blocks
    // A12: a hero still on the placeholder image falls back to the bundled black polo photo.
    .map((b) => (b.type === 'hero' && isPlaceholderMedia(b.media) ? { ...b, media: DEFAULT_HERO_MEDIA } : b))
    // The footer already carries the newsletter; unfinished story copy never ships.
    .filter((b) => b.type !== 'newsletter' && !(b.type === 'story' && isPlaceholderCopy(b.body)));
  // The stitch hero (or the presale photo) takes the lead slot. With the stitch hero, the site-content hero's
  // words become its headline ("Five animals. One polo."), and the story block becomes the large brand moment
  // below it ("Played hard. Worn after."), shown against the hero's close crop of the cloth. Without a story
  // block the hero's words fall back to the brand moment, as before.
  const hero = blocks.find((b) => b.type === 'hero');
  const story = blocks.find((b) => b.type === 'story');
  const heroCopy = hero?.type === 'hero' && hero.heading.trim() ? hero : undefined;
  const heroInStitch = Boolean(stitch && stitchMotif && heroCopy);
  const editorial = !leads
    ? undefined
    : story?.type === 'story'
      ? { heading: story.heading, subheading: plainText(story.body), media: story.media && !isPlaceholderMedia(story.media) ? story.media : heroCopy?.media, cta: story.cta }
      : heroCopy && !heroInStitch
        ? heroCopy
        : undefined;
  const ordered = leads ? blocks.filter((b) => b.type !== 'hero' && !(editorial && b === story)) : blocks;
  // Sections above bring their own bottom padding, except a full-bleed hero or the pre-order strip.
  const soonSpacing = leads && (editorial || ordered.length) ? undefined : 'pt-section';

  return (
    <>
      {leads && (
        <>
          {stitch && stitchMotif ? (
            night ? (
              <NightHero product={stitch} entry={night} tagline={heroCopy?.heading} />
            ) : (
              <StitchHero product={stitch} motif={stitchMotif} headline={heroCopy?.heading} lede={heroCopy?.subheading} />
            )
          ) : (
            featured && <PresaleHero product={featured} />
          )}
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
