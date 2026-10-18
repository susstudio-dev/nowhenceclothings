import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { PublicProduct } from '@/lib/launches';
import { formatPaise } from '@/lib/money';
import { stitchPalette, type Motif } from '@/lib/stitch-hero';
import { heroCta } from './PresaleHero';
import { QuickReserveButton } from './QuickBuyPanel';
import { quickBuyAction } from './quick-buy';
import { StitchLoupe, StitchScene, StitchStage } from './StitchStage';

const ACTION =
  'mt-7 inline-flex h-12 select-none items-center border border-ink/70 px-7 font-sans text-label font-medium uppercase tracking-label text-ink transition-[background-color,color,border-color,transform] duration-fast ease-out hover:border-ink hover:bg-ink hover:text-paper focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[3px] focus-visible:outline-ink active:scale-[0.99] motion-reduce:transition-none';

/**
 * Home lead, "the stitch" (docs/DESIGN.md): the polo draws itself on the brand's paper. The needle stitches the
 * embroidery close up, the camera pulls back, the cut pieces gather and are sewn. On the left a loupe keeps the
 * embroidery magnified above the caption. The caption is server-rendered and usable from the first frame; the
 * drawings are decorative. An open pre-order piece gets its reserve sheet in place, any other polo links to its page.
 */
export function StitchHero({ product, motif }: { product: PublicProduct; motif: Motif }) {
  const colour = product.colours[0]!;
  const pal = stitchPalette(colour.hex);
  const vars = {
    // The ground and the chalk follow Settings → Brand; the cloth follows the product colour.
    '--st-bg': 'rgb(var(--c-paper-deep))',
    '--st-chalk': 'rgb(var(--c-ink) / 0.3)',
    '--st-cloth': pal.cloth,
    '--st-hi': pal.hi,
    '--st-lo': pal.lo,
    '--st-thread': pal.thread,
    '--st-thread-hi': pal.threadHi,
    '--st-thread-lo': pal.threadLo,
    '--st-shadow': pal.shadow,
    '--st-seam': pal.seam,
  } as CSSProperties;
  const presale = product.launch.state === 'presale' && product.launch.presale;
  const href = `/products/${product.slug}`;
  const noun = /\bpolo\b/i.test(product.title) ? 'polo' : 'piece';

  return (
    <section aria-labelledby="hero-title" data-chrome-hero="light" style={vars} className="relative isolate overflow-hidden bg-paper-deep text-ink">
      <StitchScene motif={motif}>
        <div className="container-page grid pt-header md:h-[calc(100svh-6rem)] md:max-h-[68rem] md:min-h-[38rem] md:grid-cols-12 md:gap-8">
          <div className="order-2 flex flex-col justify-end pb-8 pt-4 md:order-1 md:col-span-5 md:justify-between md:pb-12 md:pt-8">
            {/* The loupe: the embroidery magnified, like the care label it sits beside. */}
            {/* Sized from the height the caption leaves (a two-line title needs about 34rem), so it never pushes the caption out. */}
            <figure aria-hidden="true" className="hidden md:block">
              <div className="relative aspect-square w-[clamp(8rem,calc(100svh_-_34rem),22rem)] overflow-hidden border border-ink/25 bg-[var(--st-cloth)]">
                <StitchLoupe />
                <span className="care-tag absolute left-3 top-3 bg-paper text-ink">Up close</span>
              </div>
              <figcaption className="mt-3 text-caption text-ink/75">Tonal embroidery, stitch by stitch.</figcaption>
            </figure>
            <div>
              {presale && <p className="care-tag">{product.launch.badge ?? 'Pre-order'}</p>}
              <h1 id="hero-title" className="mt-5 max-w-[16ch] text-balance font-display text-[clamp(1.75rem,2.8vw,2.5rem)] font-light leading-[1.08] tracking-[-0.015em]">
                <Link href={href} className="decoration-ink/40 decoration-1 underline-offset-[6px] hover:underline focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-ink">
                  {product.title}
                </Link>
              </h1>
              <p className="mt-2 text-small tabular-nums text-ink">
                {colour.name}
                {!product.launch.priceHidden && (
                  <>
                    {' · '}
                    {product.compareAtPrice && product.compareAtPrice > product.price && <s className="mr-2 text-ink/60">{formatPaise(product.compareAtPrice)}</s>}
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
          <div className="stitch-stage relative order-1 aspect-[6/7] max-h-[58svh] w-full min-h-0 md:order-2 md:col-span-7 md:aspect-auto md:h-full md:max-h-none">
            <StitchStage />
          </div>
        </div>
      </StitchScene>
    </section>
  );
}
