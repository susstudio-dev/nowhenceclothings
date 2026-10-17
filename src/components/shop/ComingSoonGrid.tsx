import Link from 'next/link';
import { Image, cn } from '@/components/ui';
import type { Drop } from '@/lib/schemas/catalogue';
import type { InventoryDoc } from '@/lib/schemas/inventory';
import type { PublicProduct } from '@/lib/launches';
import { formatPaise } from '@/lib/money';

/** One quiet tile: the (blurred) photograph and a single caption line. The section heading carries the status. */
function SoonTile({ product, priority }: { product: PublicProduct; priority?: boolean }) {
  const img = product.colours.find((c) => c.images.length)?.images[0];
  const colour = product.colours[0]?.name;
  const meta = product.launch.priceHidden ? colour : formatPaise(product.price);
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group block focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-ink"
    >
      <div className="relative aspect-garment overflow-hidden bg-paper-deep">
        {img && (
          <Image
            media={img}
            alt={img.alt || product.title}
            sizes="(min-width: 1024px) 25vw, 50vw"
            priority={priority}
            className="h-full w-full object-cover transition-transform duration-slow ease-out group-hover:scale-[1.015] motion-reduce:transition-none"
          />
        )}
      </div>
      <div className="mt-3 flex flex-col gap-0.5 md:flex-row md:items-baseline md:justify-between md:gap-4">
        <h3 className="min-w-0 truncate text-caption text-ink md:text-small">{product.title}</h3>
        {meta && <p className="shrink-0 text-caption tabular-nums text-muted">{meta}</p>}
      </div>
    </Link>
  );
}

/** A10 home "Coming soon" section. Products are already projected (blurred / hidden fields removed). */
export function ComingSoonSection({
  heading,
  products,
  className,
}: {
  heading: string;
  products: PublicProduct[];
  /** Spacing from the page (the footer already brings its own top margin). */
  className?: string;
  /** Kept for callers; the quiet tiles need neither. */
  inventory?: InventoryDoc;
  drops?: Drop[];
}) {
  if (!products.length) return null;
  return (
    <section aria-labelledby="coming-soon-heading" className={cn('container-page', className)}>
      <div className="mb-8 flex items-baseline justify-between gap-6 border-t border-line pt-6 md:mb-12 md:pt-8">
        <h2 id="coming-soon-heading" className="font-display text-h4 font-light md:text-h3">
          {heading}
        </h2>
        <Link href="/coming-soon" className="link-underline shrink-0 pb-0.5 text-label uppercase">
          See all
        </Link>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-10 md:gap-x-6 lg:grid-cols-4">
        {products.map((p, i) => (
          <li key={p.id}>
            <SoonTile product={p} priority={i < 2} />
          </li>
        ))}
      </ul>
    </section>
  );
}
