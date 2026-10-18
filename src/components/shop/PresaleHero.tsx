import Link from 'next/link';
import { Image } from '@/components/ui';
import type { PublicProduct } from '@/lib/launches';
import { formatPaise } from '@/lib/money';
import { Countdown } from './Countdown';
import { QuickReserveButton } from './QuickBuyPanel';
import { quickBuyAction } from './quick-buy';
import { countdownFor, depositSummary, pieceName, presaleNoteCopy } from './presale-copy';

/** "Reserve the Panther — ₹500" / "Pre-order — ₹1,499": the hero's one action, naming an animal piece. */
export function heroCta(product: PublicProduct): string {
  const action = quickBuyAction(product);
  const dep = depositSummary(product);
  const named = /^the\s/i.test(product.title) ? ` ${pieceName(product.title)}` : '';
  if (action.mode === 'deposit' && dep) return `Reserve${named} — ${formatPaise(dep.deposit)}`;
  if (action.mode === 'full') return `Pre-order${named} — ${formatPaise(product.price)}`;
  return action.label;
}

/**
 * A16 home lead when a presale / pre-booking piece is open: the campaign photograph runs full-bleed
 * and a small caption sits on it. One button opens the reserve sheet in place (size is chosen there).
 */
export function PresaleHero({ product }: { product: PublicProduct }) {
  const img = product.colours.find((c) => c.images.length)!.images[0];
  const { mode } = quickBuyAction(product);
  const href = `/products/${product.slug}`;
  return (
    <section
      aria-labelledby="hero-title"
      data-chrome-hero=""
      className="relative isolate flex h-[75svh] min-h-[30rem] items-end overflow-hidden bg-ink text-paper md:h-[calc(100svh-6rem)] md:max-h-[68rem] md:min-h-[38rem]"
    >
      <Image
        media={img}
        alt={img.alt || product.title}
        priority
        sizes="100vw"
        className="absolute inset-0 -z-20 h-full w-full object-cover object-[50%_6%]"
      />
      {/* Flat ink scrim for legibility; never a box behind the type. */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-ink/20" />

      <div className="container-page w-full pb-8 md:pb-12">
        <p className="care-tag text-paper/90">{product.launch.badge ?? 'Pre-order'}</p>
        <h1 id="hero-title" className="mt-5 max-w-[18ch] text-balance font-display text-[clamp(1.75rem,2.8vw,2.5rem)] font-light leading-[1.08] tracking-[-0.015em]">
          <Link href={href} className="decoration-paper/40 decoration-1 underline-offset-[6px] hover:underline focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-paper">
            {product.title}
          </Link>
        </h1>
        {!product.launch.priceHidden && (
          <p className="mt-2 text-small tabular-nums text-paper/80">
            {product.compareAtPrice && product.compareAtPrice > product.price && (
              <s className="mr-2 text-paper/50">{formatPaise(product.compareAtPrice)}</s>
            )}
            {formatPaise(product.price)}
          </p>
        )}
        <QuickReserveButton
          product={product}
          mode={mode}
          className="mt-7 inline-flex h-12 select-none items-center border border-paper/70 px-7 font-sans text-label font-medium uppercase tracking-label text-paper transition-[background-color,color,border-color,transform] duration-fast ease-out hover:border-paper hover:bg-paper hover:text-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[3px] focus-visible:outline-paper active:scale-[0.99] motion-reduce:transition-none"
        >
          {heroCta(product)}
        </QuickReserveButton>
      </div>
    </section>
  );
}

/** The strip under the hero: the run size, when the piece opens and what reserving costs, with a small live clock. */
export function PresaleNote({ product }: { product: PublicProduct }) {
  const countdown = countdownFor(product.launch);
  const copy = presaleNoteCopy(product);
  if (!copy) return null;
  return (
    <aside aria-label="Pre-order" className="border-b border-line">
      <div className="container-page flex flex-col gap-2 py-5 md:flex-row md:items-baseline md:justify-between md:gap-10 md:py-6">
        <div className="space-y-1">
          {copy.heading && <p className="font-display text-h3 font-light text-ink">{copy.heading}</p>}
          {copy.body && <p className="max-w-2xl text-small text-ink-soft">{copy.body}</p>}
        </div>
        {countdown && <Countdown variant="clock" releaseAt={countdown.at} label={countdown.label} className="text-caption text-muted md:text-right" />}
      </div>
    </aside>
  );
}
