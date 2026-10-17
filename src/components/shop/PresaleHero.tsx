import Link from 'next/link';
import { Image, Price } from '@/components/ui';
import type { PublicProduct } from '@/lib/launches';
import type { InventoryDoc } from '@/lib/schemas/inventory';
import { Countdown } from './Countdown';
import { QuickBuyPanel } from './QuickBuyPanel';
import { quickBuyAction } from './quick-buy';
import { stockMap } from './merch';
import { countdownFor, depositSummary, heroDepositLine } from './presale-copy';

/** A16: home hero featuring the open presale / pre-booking piece, buyable in place. */
export function PresaleHero({ product, inventory }: { product: PublicProduct; inventory: InventoryDoc }) {
  const img = product.colours.find((c) => c.images.length)!.images[0];
  const pre = product.launch.presale!;
  const action = quickBuyAction(product);
  const dep = depositSummary(product);
  const countdown = countdownFor(product.launch);
  return (
    <section aria-labelledby="hero-title" className="border-b border-line md:grid md:min-h-[calc(100svh-6rem)] md:grid-cols-12">
      <Link href={`/products/${product.slug}`} className="relative block overflow-hidden bg-paper-deep md:col-span-7" aria-label={product.title}>
        <Image media={img} alt={img.alt || product.title} priority sizes="(min-width: 768px) 58vw, 100vw" className="aspect-[4/5] h-full w-full object-cover md:absolute md:inset-0 md:aspect-auto" />
      </Link>
      <div className="flex flex-col justify-center px-gutter py-10 md:col-span-5 md:px-12 lg:px-16">
        <p className="care-tag self-start">{product.launch.badge ?? 'Pre-order'}</p>
        <h1 id="hero-title" className="mt-6 text-balance font-display text-display font-light">{product.title}</h1>
        <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <Price amount={product.price} compareAt={product.compareAtPrice} size="md" />
          <span className="text-caption text-muted">Inclusive of all taxes</span>
        </div>
        {dep && <p className="mt-2 text-small tabular-nums text-ink-soft">{heroDepositLine(dep)}</p>}
        {pre.shipCopy && <p className="mt-3 max-w-sm text-small text-muted">{pre.shipCopy}</p>}
        <QuickBuyPanel product={product} stock={stockMap(product, inventory)} mode={action.mode} cta={action.label} access={pre.access} />
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4 text-caption text-muted">
          <span>Limit {pre.perCustomerLimit} per customer</span>
          <Link href={`/products/${product.slug}`} className="link-underline text-ink">Details</Link>
        </div>
        {countdown && (
          <div className="mt-6"><Countdown releaseAt={countdown.at} label={countdown.label} /></div>
        )}
      </div>
    </section>
  );
}
