import Link from 'next/link';
import type { PublicProduct } from '@/lib/launches';
import { formatPaise } from '@/lib/money';
import type { NightHeroEntry } from '@/lib/night-hero';
import { NightStage } from './NightStage';
import { heroCta } from './PresaleHero';
import { QuickReserveButton } from './QuickBuyPanel';
import { quickBuyAction } from './quick-buy';

const ACTION =
  'mt-7 inline-flex h-12 select-none items-center border border-paper bg-paper px-7 font-sans text-label font-medium uppercase tracking-label text-ink transition-[background-color,color,transform] duration-fast ease-out hover:bg-transparent hover:text-paper focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[3px] focus-visible:outline-paper active:scale-[0.99] motion-reduce:transition-none';

/**
 * Home lead, "eyes in the dark" (docs/DESIGN.md): the real cloth, dark, with a panther's eyes; under the visitor's
 * light the real embroidery stitches itself in, then the room lights up. The poster (the lit, embroidered crop) is
 * the first paint and the whole hero under reduced motion; the copy and action are server-rendered and usable
 * from the first frame. A pre-order piece gets its reserve sheet in place, any other polo links to its page.
 */
export function NightHero({ product, entry, tagline }: { product: PublicProduct; entry: NightHeroEntry; tagline?: string }) {
  const colour = product.colours[0]!;
  const presale = product.launch.state === 'presale' && product.launch.presale;
  const href = `/products/${product.slug}`;
  const noun = /\bpolo\b/i.test(product.title) ? 'polo' : 'piece';
  const { wide, tall } = entry.crops;

  return (
    <section
      aria-labelledby="hero-title"
      data-chrome-hero
      className="relative isolate h-[min(88svh,52rem)] min-h-[34rem] overflow-hidden bg-ink text-paper md:h-[calc(100svh-6rem)] md:max-h-[68rem] md:min-h-[38rem]"
    >
      <picture>
        <source media="(min-width: 768px)" srcSet={wide.full} width={wide.w} height={wide.h} />
        <img
          src={tall.full}
          width={tall.w}
          height={tall.h}
          alt={`${product.title}: the tonal embroidery on black piqué, close up`}
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </picture>
      <NightStage entry={entry} />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/60 via-35% to-transparent to-65% md:bg-gradient-to-r md:from-ink/80 md:via-ink/50 md:via-30% md:to-transparent md:to-55%"
      />
      <div className="container-page relative flex h-full flex-col justify-end pb-10 pt-header md:pb-14">
        <div className="max-w-[30rem]">
          {presale && <p className="care-tag">{product.launch.badge ?? 'Pre-order'}</p>}
          <h1 id="hero-title" className="mt-5 text-balance font-display text-[clamp(1.875rem,3.6vw,3.25rem)] font-light leading-[1.04] tracking-[-0.015em]">
            {entry.lines[0]} <span className="block">{entry.lines[1]}</span>
          </h1>
          {tagline && <p className="mt-4 text-small text-paper/75">{tagline}</p>}
          <p className="mt-4 text-small text-paper">
            <Link href={href} className="link-underline">
              {product.title}
            </Link>
          </p>
          <p className="mt-1 text-small tabular-nums text-paper/80">
            {colour.name}
            {!product.launch.priceHidden && (
              <>
                {' · '}
                {product.compareAtPrice && product.compareAtPrice > product.price && <s className="mr-2 text-paper/55">{formatPaise(product.compareAtPrice)}</s>}
                {formatPaise(product.price)}
              </>
            )}
          </p>
          {presale ? (
            <QuickReserveButton product={product} mode={quickBuyAction(product).mode} className={ACTION}>
              {heroCta(product)}
            </QuickReserveButton>
          ) : (
            <Link href={href} className={ACTION}>
              View the {noun}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
