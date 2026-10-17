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

/** Listing tile. Sold-out and unreleased products stay visible but are labelled (S2, S4). */
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
          : base.compareAt
            ? 'Sale'
            : null;

  return (
    <article className="group relative">
      <Link href={`/products/${product.slug}`} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
        <div className="relative aspect-[4/5] overflow-hidden bg-line/40">
          {first && (
            <Image
              media={first}
              alt={first.alt || product.title}
              sizes="(min-width: 1024px) 25vw, 50vw"
              priority={priority}
              className={'h-full w-full object-cover' + (soldOut ? ' opacity-60' : '')}
            />
          )}
          {second && state !== 'coming_soon' && (
            <div aria-hidden className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none">
              <Image media={second} alt="" sizes="(min-width: 1024px) 25vw, 50vw" className="h-full w-full object-cover" />
            </div>
          )}
          {badge && (
            <span className="absolute left-2 top-2 bg-paper px-2 py-1 text-[11px] uppercase tracking-widest">{badge}</span>
          )}
        </div>
        <div className="mt-3 flex items-start justify-between gap-3 text-sm">
          <h3>{product.title}</h3>
          {!launch?.priceHidden && <Price amount={from} compareAt={from === product.price ? base.compareAt : undefined} size="sm" />}
        </div>
      </Link>
      {product.colours.length > 1 && (
        <ul className="mt-2 flex gap-1.5" aria-label={`${product.colours.length} colours`}>
          {product.colours.map((c) => (
            <li key={c.id} title={c.name} className="h-3 w-3 rounded-full border border-line" style={{ backgroundColor: c.hex }}>
              <span className="sr-only">{c.name}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function ProductGrid({
  products,
  inventory,
  drops,
  empty = 'Nothing here yet.',
}: {
  products: CardProduct[];
  inventory: InventoryDoc;
  drops: Drop[];
  empty?: string;
}) {
  if (!products.length) return <p className="py-16 text-center text-muted">{empty}</p>;
  const now = new Date();
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} inventory={inventory} drops={drops} now={now} priority={i < 4} />
        </li>
      ))}
    </ul>
  );
}
