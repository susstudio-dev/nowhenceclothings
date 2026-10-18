import Link from 'next/link';
import { Image } from '@/components/ui';
import type { PublicProduct } from '@/lib/launches';
import { formatPaise } from '@/lib/money';
import { Countdown } from './Countdown';
import { QuickReserveButton } from './QuickBuyPanel';
import { quickBuyAction } from './quick-buy';
import { countdownFor, depositSummary, heroDepositLine } from './presale-copy';

/** "Reserve — ₹500" / "Pre-order — ₹1,499": the hero's one action. */
export function heroCta(product: PublicProduct): string {
  const action = quickBuyAction(product);
  const dep = depositSummary(product);
  if (action.mode === 'deposit' && dep) return `Reserve — ${formatPaise(dep.deposit)}`;
  if (action.mode === 'full') return `Pre-order — ${formatPaise(product.price)}`;
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

/** One quiet line under the hero: when the sale opens (small live countdown) and what reserving costs. */
export function PresaleNote({ product }: { product: PublicProduct }) {
  const countdown = countdownFor(product.launch);
  const dep = depositSummary(product);
  const ship = product.launch.presale?.shipCopy;
  const right = dep ? heroDepositLine(dep) : ship;
  if (!countdown && !right) return null;
  return (
    <aside aria-label="Pre-order" className="border-b border-line">
      <div className="container-page flex flex-col gap-1 py-4 text-caption text-muted md:flex-row md:items-baseline md:justify-between md:gap-10 md:py-5">
        {countdown && <Countdown variant="inline" releaseAt={countdown.at} label={countdown.label} className="text-ink-soft" />}
        {right && <p className="tabular-nums md:text-right">{right}</p>}
      </div>
    </aside>
  );
}
