import Link from 'next/link';
import { Image, Price } from '@/components/ui';
import type { Drop, Product } from '@/lib/schemas/catalogue';
import type { InventoryDoc } from '@/lib/schemas/inventory';
import type { LaunchView } from '@/lib/launches';
import { dropFor, isSoldOut, minPrice, variantPrice } from './merch';

/** Products reaching the storefront are projected (A10) and carry `launch`. */
type CardProduct = Product & { launch?: LaunchView };

export interface ProductCardProps {
  product: CardProduct;
  inventory: InventoryDoc;
  drops: Drop[];
  now?: Date;
  priority?: boolean;
}

/** Listing tile. Sold-out and unreleased products stay visible but are labelled (S2, S4). One care-label at most. */
export function ProductCard({ product, inventory, drops, now = new Date(), priority }: ProductCardProps) {
  const [first, second] = product.colours[0]?.images ?? [];
  const drop = dropFor(product, drops);
  const launch = product.launch;
  const state = launch?.state ?? 'available';
  const upcoming = state === 'coming_soon' || (state === 'available' && drop && new Date(drop.releaseAt).getTime() > now.getTime());
  const soldOut = state === 'sold_out' || (state === 'available' && !upcoming && isSoldOut(product, inventory));
  const base = variantPrice(product);
  const from = minPrice(product);
  const badge =
    state === 'coming_soon' || state === 'presale'
      ? launch?.badge ?? (state === 'presale' ? 'Pre-order' : 'Coming soon')
      : upcoming
        ? 'Coming soon'
        : soldOut
          ? 'Sold out'
          : null;
  const colours = product.colours.length;

  return (
    <article className="group relative">
      <Link href={`/products/${product.slug}`} className="block focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4">
        <div className="relative aspect-garment overflow-hidden bg-paper-deep">
          {first && (
            <Image
              media={first}
              alt={first.alt || product.title}
              sizes="(min-width: 1024px) 25vw, 50vw"
              priority={priority}
              className={'h-full w-full object-cover transition-transform duration-slow ease-out group-hover:scale-[1.015] motion-reduce:transition-none' + (soldOut ? ' opacity-60' : '')}
            />
          )}
          {second && state !== 'coming_soon' && (
            <div aria-hidden className="absolute inset-0 hidden opacity-0 transition-opacity duration-slow ease-out group-hover:opacity-100 motion-reduce:transition-none md:block">
              <Image media={second} alt="" sizes="25vw" className="h-full w-full object-cover" />
            </div>
          )}
          {badge && <span className="care-tag absolute left-2 top-2 bg-paper/90 text-ink md:left-3 md:top-3">{badge}</span>}
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-3">
          <h3 className="min-w-0 truncate text-small text-ink">{product.title}</h3>
          {!launch?.priceHidden && (
            <Price amount={from} compareAt={from === product.price ? base.compareAt : undefined} size="sm" className="shrink-0 text-small" />
          )}
        </div>
        <p className="mt-0.5 text-caption text-muted">
          {colours > 1 ? `${colours} colours` : product.colours[0]?.name}
        </p>
      </Link>
    </article>
  );
}

export function ProductGrid({
  products,
  inventory,
  drops,
  empty = 'Nothing here yet.',
  cols = 4,
}: {
  products: CardProduct[];
  inventory: InventoryDoc;
  drops: Drop[];
  empty?: string;
  /** Desktop columns. */
  cols?: 2 | 3 | 4;
}) {
  if (!products.length)
    return (
      <div className="border-y border-line py-20 text-center">
        <p className="font-display text-h4 font-light">{empty}</p>
        <Link href="/shop" className="link-underline mt-4 inline-block text-label uppercase">Back to the shop</Link>
      </div>
    );
  const now = new Date();
  const lg = cols === 2 ? 'lg:grid-cols-2' : cols === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4';
  return (
    <ul className={'grid grid-cols-2 gap-x-3 gap-y-10 md:gap-x-4 md:gap-y-14 ' + lg}>
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} inventory={inventory} drops={drops} now={now} priority={i < 4} />
        </li>
      ))}
    </ul>
  );
}
