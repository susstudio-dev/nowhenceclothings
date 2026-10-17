'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Dialog, Image, Price } from '@/components/ui';
import type { Product, SizeChart } from '@/lib/schemas/catalogue';
import type { MediaRef } from '@/lib/schemas/common';
// Commerce workstream (WS-C) owns the cart store.
import { addToCart, MixedCartError } from '@/lib/commerce/cart-client';
import type { LaunchView } from '@/lib/launches';
import { PresaleAccessGate, presaleCodeKey } from './PresaleAccessGate';
import { Countdown } from './Countdown';
import { NotifyMe } from './NotifyMe';
import { SizeGuide } from './SizeGuide';
import { variantPrice } from './merch';

export interface ProductViewProps {
  product: Product;
  /** sku -> units available. */
  stock: Record<string, number>;
  sizeChart?: SizeChart;
  /** ISO release time when the product is in a drop that has not released yet. */
  upcomingReleaseAt?: string;
  maxQty?: number;
  /** A10/A11 launch state (from the public projection). */
  launch?: LaunchView;
}

const LOW_STOCK = 3;

/** Product page interactive area (S3, S4): gallery, colour swatches, size selector, add to bag. */
export function ProductView({ product, stock, sizeChart, upcomingReleaseAt, launch }: ProductViewProps) {
  const soon = launch?.state === 'coming_soon';
  const pre = launch?.state === 'presale' ? launch.presale : undefined;
  const [unlocked, setUnlocked] = useState(false);
  const [mixMsg, setMixMsg] = useState('');
  useEffect(() => {
    if (pre?.access !== 'code') return;
    try {
      if (sessionStorage.getItem(presaleCodeKey(product.id))) setUnlocked(true);
    } catch {
      /* storage blocked */
    }
  }, [pre?.access, product.id]);
  const [colourId, setColourId] = useState(product.colours[0].id);
  const [size, setSize] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'added' | 'error'>('idle');
  const [sizeError, setSizeError] = useState(false);
  const colour = product.colours.find((c) => c.id === colourId) ?? product.colours[0];

  const variantsBySize = useMemo(
    () => new Map(product.variants.filter((v) => v.colourId === colour.id).map((v) => [v.size, v])),
    [product.variants, colour.id],
  );
  const variant = size ? variantsBySize.get(size as Product['sizes'][number]) : undefined;
  const units = variant ? (pre ? 10 : stock[variant.sku] ?? 0) : 0;
  const price = variantPrice(product, variant);
  const upcoming = !!upcomingReleaseAt;

  function add() {
    if (!variant) {
      setSizeError(true);
      return;
    }
    try {
      const img = colour.images[0];
      addToCart({
        sku: variant.sku,
        qty: 1,
        productId: product.id,
        slug: product.slug,
        title: product.title,
        colour: colour.name,
        size: variant.size,
        unitPrice: price.amount,
        compareAtPrice: price.compareAt,
        image: img ? img.src ?? (img.widths.length ? `/media/${img.id}/${img.widths[0]}.webp` : undefined) : undefined,
        ...(pre ? { preorder: true } : {}),
      });
      setMixMsg('');
      setStatus('added');
    } catch (e) {
      if (e instanceof MixedCartError) {
        setMixMsg(e.message);
        return;
      }
      setStatus('error');
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[3fr_2fr] lg:gap-12">
      <Gallery key={colour.id} images={colour.images} title={`${product.title} in ${colour.name}`} />

      <div className="lg:sticky lg:top-24 lg:self-start">
        <h1 className="font-display text-3xl">{product.title}</h1>
        {launch?.badge && launch.state !== 'available' && (
          <p className="mt-2 inline-block border border-ink px-2 py-1 text-[11px] uppercase tracking-widest">{launch.badge}</p>
        )}
        {!launch?.priceHidden && (
          <>
            <Price amount={price.amount} compareAt={price.compareAt} size="lg" className="mt-2" />
            <p className="mt-1 text-xs text-muted">Inclusive of all taxes</p>
          </>
        )}
        {soon && launch?.teaser && <p className="mt-4 text-sm">{launch.teaser}</p>}
        {pre && <p className="mt-3 text-sm">{pre.shipCopy}</p>}

        <fieldset className="mt-8">
          <legend className="text-xs uppercase tracking-widest">
            Colour <span className="text-muted normal-case tracking-normal">· {colour.name}</span>
          </legend>
          <div className="mt-3 flex flex-wrap gap-3">
            {product.colours.map((c) => (
              <label key={c.id} className="cursor-pointer">
                <input
                  type="radio"
                  name="colour"
                  value={c.id}
                  checked={c.id === colour.id}
                  onChange={() => {
                    setColourId(c.id);
                    setStatus('idle');
                  }}
                  className="peer sr-only"
                />
                <span
                  className="block h-11 w-11 rounded-full border-2 border-transparent p-1 peer-checked:border-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2"
                  title={c.name}
                >
                  <span className="block h-full w-full rounded-full border border-line" style={{ backgroundColor: c.hex }} />
                </span>
                <span className="sr-only">{c.name}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {!soon && (
        <fieldset className="mt-6" aria-describedby={sizeError ? 'size-error' : undefined}>
          <div className="flex items-center justify-between">
            <legend className="text-xs uppercase tracking-widest">Size</legend>
            {sizeChart && <SizeGuide chart={sizeChart} />}
          </div>
          <div className="mt-3 grid grid-cols-6 gap-2">
            {product.sizes.map((s) => {
              const v = variantsBySize.get(s);
              const n = v ? stock[v.sku] ?? 0 : 0;
              const out = !v || n === 0;
              return (
                <label key={s} className="cursor-pointer">
                  <input
                    type="radio"
                    name="size"
                    value={s}
                    checked={size === s}
                    disabled={!v}
                    onChange={() => {
                      setSize(s);
                      setSizeError(false);
                      setStatus('idle');
                    }}
                    className="peer sr-only"
                  />
                  <span
                    className={
                      'flex min-h-[44px] items-center justify-center border text-sm peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 ' +
                      (out ? 'border-line text-muted line-through' : 'border-line hover:border-ink')
                    }
                  >
                    {s}
                  </span>
                  <span className="sr-only">{out ? ' (sold out)' : n <= LOW_STOCK ? ` (only ${n} left)` : ''}</span>
                </label>
              );
            })}
          </div>
          <p className="mt-2 min-h-[1.25rem] text-xs" aria-live="polite">
            {sizeError ? (
              <span id="size-error" className="text-sale">Choose a size.</span>
            ) : variant && units > 0 && units <= LOW_STOCK ? (
              `Only ${units} left in ${size}.`
            ) : null}
          </p>
        </fieldset>
        )}

        <div className="mt-4 space-y-3">
          {soon ? (
            <>
              {launch?.nextChangeAt && <Countdown releaseAt={launch.nextChangeAt} />}
              {launch?.notify && (
                <>
                  <p className="text-sm">Get an email the moment this is ready.</p>
                  <NotifyMe productId={product.id} label="Notify me" />
                </>
              )}
            </>
          ) : pre ? (
            <>
              {pre.access === 'code' && !unlocked ? (
                <PresaleAccessGate productId={product.id} onUnlocked={() => setUnlocked(true)} />
              ) : (
                <Button fullWidth size="lg" onClick={add}>
                  {pre.ctaLabel}
                </Button>
              )}
              {pre.access === 'waitlist' && (
                <>
                  <p className="text-sm">Open to the waitlist only. Check out with the email you signed up with, or join below.</p>
                  <NotifyMe productId={product.id} label="Join the waitlist" />
                </>
              )}
              {launch?.nextChangeAt && <Countdown releaseAt={launch.nextChangeAt} />}
              <p className="text-xs text-muted">
                Limit {pre.perCustomerLimit} per customer. {pre.terms}
              </p>
            </>
          ) : upcoming ? (
            <>
              <Countdown releaseAt={upcomingReleaseAt!} />
              <p className="text-sm">Get an email the moment this drops.</p>
              <NotifyMe sku={(variant ?? product.variants[0]).sku} label="Notify me" />
            </>
          ) : variant && units === 0 ? (
            <>
              <p className="text-sm">
                {colour.name} / {size} is sold out. We&apos;ll let you know when it&apos;s back.
              </p>
              <NotifyMe sku={variant.sku} />
            </>
          ) : (
            <Button fullWidth size="lg" onClick={add}>
              Add to bag
            </Button>
          )}
          <p role="status" className="text-sm">
            {mixMsg || (status === 'added' ? 'Added to your bag.' : status === 'error' ? 'Could not add to bag. Try again.' : '')}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Swipeable (scroll-snap) on mobile, stacked on desktop; click to zoom. */
function Gallery({ images, title }: { images: MediaRef[]; title: string }) {
  const [zoom, setZoom] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  if (!images.length) return <div className="aspect-[4/5] bg-line/40" />;
  return (
    <section aria-label={`${title} images`}>
      <div
        ref={track}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth motion-reduce:scroll-auto lg:grid lg:grid-cols-2 lg:gap-2 lg:overflow-visible [&::-webkit-scrollbar]:hidden"
        tabIndex={0}
        aria-roledescription="carousel"
      >
        {images.map((m, i) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setZoom(i)}
            className="w-full shrink-0 snap-center cursor-zoom-in lg:first:col-span-2"
            aria-label={`Zoom image ${i + 1} of ${images.length}`}
          >
            <Image
              media={m}
              alt={m.alt || title}
              priority={i === 0}
              sizes="(min-width: 1024px) 60vw, 100vw"
              className="aspect-[4/5] h-auto w-full object-cover"
            />
          </button>
        ))}
      </div>
      {images.length > 1 && (
        <p className="mt-2 text-center text-xs text-muted lg:hidden" aria-live="polite">
          {index + 1} / {images.length}
        </p>
      )}
      <Dialog open={zoom != null} onClose={() => setZoom(null)} title={title} className="max-h-[95vh] max-w-[95vw]">
        {zoom != null && (
          <div className="overflow-auto">
            <Image media={images[zoom]} alt={images[zoom].alt || title} sizes="100vw" className="h-auto w-[160%] max-w-none" />
          </div>
        )}
        <Button variant="secondary" className="mt-4" onClick={() => setZoom(null)}>
          Close
        </Button>
      </Dialog>
    </section>
  );
}
