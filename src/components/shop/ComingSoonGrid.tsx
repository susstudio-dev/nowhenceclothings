import Link from 'next/link';
import type { Drop } from '@/lib/schemas/catalogue';
import type { InventoryDoc } from '@/lib/schemas/inventory';
import type { PublicProduct } from '@/lib/launches';
import { ProductGrid } from './ProductCard';

/** A10 home "Coming soon" section. Products are already projected (blurred / hidden fields removed). */
export function ComingSoonSection({
  heading,
  products,
  inventory,
  drops,
}: {
  heading: string;
  products: PublicProduct[];
  inventory: InventoryDoc;
  drops: Drop[];
}) {
  if (!products.length) return null;
  return (
    <section aria-labelledby="coming-soon-heading" className="mx-auto max-w-7xl px-4 py-16 md:px-8">
      <div className="mb-8 flex items-baseline justify-between gap-4">
        <h2 id="coming-soon-heading" className="font-display text-3xl">
          {heading}
        </h2>
        <Link href="/coming-soon" className="text-sm underline">
          See all
        </Link>
      </div>
      <ProductGrid products={products} inventory={inventory} drops={drops} />
    </section>
  );
}
