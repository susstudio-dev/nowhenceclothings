'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Dialog, Image, Price } from '@/components/ui';
import { buttonClass } from '@/components/ui/Button';
import { SizeSelector } from '@/components/ui/SizeSelector';
import { Swatch } from '@/components/ui/Swatch';
import type { Product, SizeChart } from '@/lib/schemas/catalogue';
import type { MediaRef } from '@/lib/schemas/common';
// Commerce workstream (WS-C) owns the cart store.
import { addToCart, MixedCartError } from '@/lib/commerce/cart-client';
import type { LaunchView, PublicProduct } from '@/lib/launches';
import { formatPaise } from '@/lib/money';
import { PresaleAccessGate, presaleCodeKey } from './PresaleAccessGate';
import { Countdown } from './Countdown';
import { NotifyMe } from './NotifyMe';
import { SizeGuide } from './SizeGuide';
import { variantPrice } from './merch';
import { QuickBuySheet } from './checkout/QuickBuySheet';
import { quickBuyAction, RESERVE_SEPARATE_NOTE, sizeGridClass } from './quick-buy';
import { countdownFor, depositSummary, depositTodayLine } from './presale-copy';
import { track, viewContentParams } from '@/lib/analytics/meta';

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
  /** Rendered under the buy area (details accordions). */
  details?: React.ReactNode;
  /** Small line above the title, e.g. category. */
  eyebrow?: string;
}

const LOW_STOCK = 3;

/** Product page interactive area (S3, S4, A16): gallery, colour, size, add to bag + buy now. */
export function ProductView({ product, stock, sizeChart, upcomingReleaseAt, launch, details, eyebrow }: ProductViewProps) {
  const router = useRouter();
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
  const [quick, setQuick] = useState(false);
  const colour = product.colours.find((c) => c.id === colourId) ?? product.colours[0];

  // Meta ViewContent, once per product view. Skipped while a coming-soon
  // piece hides its title or price (A10 secrecy: never sent to Meta).
  const viewed = useRef<string | null>(null);
  const secret = !!launch?.titleHidden || !!launch?.priceHidden;
  useEffect(() => {
    if (secret || viewed.current === product.id) return;
    viewed.current = product.id;
    track('ViewContent', viewContentParams({ productId: product.id, title: product.title, price: variantPrice(product, undefined).amount }));
  }, [secret, product]);

  const variantsBySize = useMemo(
    () => new Map(product.variants.filter((v) => v.colourId === colour.id).map((v) => [v.size, v])),
    [product.variants, colour.id],
  );
  const variant = size ? variantsBySize.get(size as Product['sizes'][number]) : undefined;
  const units = variant ? (pre ? 10 : stock[variant.sku] ?? 0) : 0;
  const price = variantPrice(product, variant);
  const upcoming = !!upcomingReleaseAt;
  const deposit = pre?.paymentMode === 'deposit' && pre.deposit ? pre.deposit : undefined;
  const gated = pre?.access === 'code' && !unlocked && !deposit;
  const canBuy = !soon && !upcoming && !gated && !(variant && units === 0);
  const action = launch ? quickBuyAction({ ...product, launch } as PublicProduct) : { mode: 'buy' as const, label: 'Buy now' };
  const depositTerms = launch ? depositSummary({ price: product.price, launch }) : undefined;
  const preCountdown = pre && launch ? countdownFor(launch) : undefined;

  function line() {
    const img = colour.images[0];
    return {
      sku: variant!.sku,
      qty: 1,
      productId: product.id,
      slug: product.slug,
      title: product.title,
      colour: colour.name,
      size: variant!.size,
      unitPrice: price.amount,
      compareAtPrice: price.compareAt,
      image: img ? img.src ?? (img.widths.length ? `/media/${img.id}/${img.widths[0]}.webp` : undefined) : undefined,
      ...(pre ? { preorder: true } : {}),
    };
  }

  function needSize(): boolean {
    if (variant) return false;
    setSizeError(true);
    document.getElementById('pdp-size')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return true;
  }

  function add() {
    if (needSize()) return;
    try {
      addToCart(line());
      setMixMsg('');
      setStatus('added');
    } catch (e) {
      if (e instanceof MixedCartError) return setMixMsg(e.message);
      setStatus('error');
    }
  }

  /** A16: straight to checkout (or the booking sheet for deposits), no bag detour. */
  function buyNow() {
    if (needSize()) return;
    if (deposit || pre) return setQuick(true);
    try {
      addToCart(line(), { open: false });
      router.push('/checkout');
    } catch (e) {
      if (e instanceof MixedCartError) return setMixMsg(e.message);
      setStatus('error');
    }
  }

  const sizeOptions = product.sizes.map((s) => {
    const v = variantsBySize.get(s);
    const n = v ? stock[v.sku] ?? 0 : 0;
    const out = !v || (!pre && n === 0);
    return { value: s, label: s, disabled: !v, note: !pre && !out && n <= LOW_STOCK ? `${n} left` : out && v ? 'Sold out' : undefined };
  });

  const primaryLabel = pre ? action.label : 'Buy now';

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
      <div className="-mx-gutter lg:col-span-7 lg:mx-0">
        <Gallery key={colour.id} images={colour.images} title={`${product.title} in ${colour.name}`} />
      </div>

      <div className="lg:col-span-5 lg:col-start-8">
        <div className="lg:sticky lg:top-[calc(var(--sticky-offset)+2rem)]">
          <div className="flex items-center gap-3">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {launch?.badge && launch.state !== 'available' && <p className="care-tag">{launch.badge}</p>}
          </div>
          <h1 className="mt-4 text-balance font-display text-h3 font-light lg:text-[2.5rem] lg:leading-[1.1]">{product.title}</h1>
          {product.colours.length === 1 && <p className="mt-1 text-small text-muted">{colour.name}</p>}
          {!launch?.priceHidden && (
            <div className="mt-4 flex items-baseline gap-3">
              <Price amount={price.amount} compareAt={price.compareAt} size="md" />
              <span className="text-caption text-muted">Inclusive of all taxes</span>
            </div>
          )}
          {deposit && (
            <p className="mt-2 text-small tabular-nums text-ink-soft">
              {depositTerms ? depositTodayLine(depositTerms) : `${deposit.label} today · the balance when the sale opens`}
            </p>
          )}
          {soon && launch?.teaser && <p className="mt-6 max-w-md text-small text-ink-soft">{launch.teaser}</p>}
          {pre?.shipCopy && <p className="mt-2 text-small text-muted">{pre.shipCopy}</p>}

          <div className="mt-8 space-y-8 border-t border-line pt-8">
            {product.colours.length > 1 && (
              <Swatch
                options={product.colours.map((c) => ({ value: c.id, label: c.name, hex: c.hex }))}
                value={colour.id}
                onChange={(v) => {
                  setColourId(v);
                  setStatus('idle');
                }}
              />
            )}

            {!soon && (
              <div id="pdp-size">
                <SizeSelector
                  options={sizeOptions}
                  value={size ?? undefined}
                  onChange={(v) => {
                    setSize(v);
                    setSizeError(false);
                    setStatus('idle');
                  }}
                  aside={sizeChart ? <SizeGuide chart={sizeChart} /> : undefined}
                  error={sizeError ? 'Choose a size.' : undefined}
                  className={sizeGridClass(sizeOptions.length)}
                />
              </div>
            )}

            <div className="space-y-4">
              {soon ? (
                <>
                  {launch?.nextChangeAt && <Countdown releaseAt={launch.nextChangeAt} />}
                  {launch?.notify && (
                    <div className="space-y-3">
                      <p className="text-small text-ink-soft">Get an email the moment this is ready.</p>
                      <NotifyMe productId={product.id} label="Notify me" />
                    </div>
                  )}
                </>
              ) : upcoming ? (
                <>
                  <Countdown releaseAt={upcomingReleaseAt!} />
                  <p className="text-small text-ink-soft">Get an email the moment this drops.</p>
                  <NotifyMe sku={(variant ?? product.variants[0]).sku} label="Notify me" />
                </>
              ) : gated ? (
                <PresaleAccessGate productId={product.id} onUnlocked={() => setUnlocked(true)} />
              ) : variant && units === 0 ? (
                <>
                  <p className="text-small">
                    {colour.name} / {size} is sold out. We&apos;ll let you know when it&apos;s back.
                  </p>
                  <NotifyMe sku={variant.sku} />
                </>
              ) : deposit ? (
                <Button fullWidth size="lg" onClick={buyNow}>{primaryLabel}</Button>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button fullWidth size="lg" onClick={buyNow} className="sm:order-2">
                    {primaryLabel}
                  </Button>
                  <Button variant="secondary" fullWidth size="lg" onClick={add} className="sm:order-1">
                    Add to bag
                  </Button>
                </div>
              )}
              {pre && (
                <div className="space-y-1.5 text-caption text-muted">
                  {pre.access === 'waitlist' && (
                    <div className="space-y-3 pb-2">
                      <p>Open to the waitlist only. Check out with the email you signed up with, or join below.</p>
                      <NotifyMe productId={product.id} label="Join the waitlist" />
                    </div>
                  )}
                  {preCountdown && <Countdown variant="inline" releaseAt={preCountdown.at} label={preCountdown.label} className="text-ink-soft" />}
                  {deposit && <p>{RESERVE_SEPARATE_NOTE}</p>}
                  <p>Limit {pre.perCustomerLimit} per customer.{deposit ? ' Full booking terms are shown before you pay.' : ` ${pre.terms}`}</p>
                </div>
              )}
              <p role="status" className="min-h-[1.25rem] text-small">
                {mixMsg ||
                  (status === 'added' ? 'Added to your bag.' : status === 'error' ? 'Could not add to bag. Try again.' : '')}
              </p>
            </div>
          </div>

          {details && <div className="mt-6">{details}</div>}
        </div>
      </div>

      {/* Mobile: price + primary action always in thumb reach. */}
      {canBuy && (
        <div className="fixed inset-x-0 bottom-0 z-header flex items-center gap-3 border-t border-line bg-paper/95 px-gutter py-3 backdrop-blur lg:hidden">
          <div className="min-w-0 flex-1">
            <p className="truncate text-caption text-ink">{product.title}</p>
            {!launch?.priceHidden && (
              <p className="text-caption tabular-nums text-muted">
                {formatPaise(price.amount)}
                {size ? ` · ${colour.name} / ${size}` : ''}
              </p>
            )}
          </div>
          <button type="button" onClick={buyNow} className={buttonClass('primary', 'md')}>
            {deposit ? 'Reserve' : pre ? 'Pre-order' : 'Buy now'}
          </button>
        </div>
      )}
      {canBuy && <div className="h-16 lg:hidden" aria-hidden />}

      {quick && variant && launch && (
        <QuickBuySheet
          product={{ ...product, launch } as PublicProduct}
          colourId={colour.id}
          size={variant.size}
          mode={deposit ? 'deposit' : pre ? 'full' : 'buy'}
          onClose={() => setQuick(false)}
        />
      )}
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

  if (!images.length) return <div className="aspect-garment bg-paper-deep" />;
  return (
    <section aria-label={`${title} images`} className="relative">
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
            className={'w-full shrink-0 snap-center cursor-zoom-in bg-paper-deep' + (images.length % 2 ? ' lg:first:col-span-2' : '')}
            aria-label={`Zoom image ${i + 1} of ${images.length}`}
          >
            <Image
              media={m}
              alt={m.alt || title}
              priority={i === 0}
              sizes="(min-width: 1024px) 58vw, 100vw"
              className="aspect-garment h-auto w-full object-cover"
            />
          </button>
        ))}
      </div>
      {images.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5 lg:hidden" aria-live="polite">
          <span className="sr-only">Image {index + 1} of {images.length}</span>
          {images.map((m, i) => (
            <span key={m.id} aria-hidden className={'h-px w-6 transition-colors duration-base ' + (i === index ? 'bg-ink' : 'bg-ink/25')} />
          ))}
        </div>
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
