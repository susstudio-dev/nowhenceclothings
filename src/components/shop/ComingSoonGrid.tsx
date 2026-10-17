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
    <section aria-labelledby="coming-soon-heading" className="container-page py-section">
      <div className="mb-8 flex items-end justify-between gap-6 border-b border-line pb-4 md:mb-10">
        <div>
          <p className="eyebrow">In the workroom</p>
          <h2 id="coming-soon-heading" className="mt-3 font-display text-display-sm font-light">
            {heading}
          </h2>
        </div>
        <Link href="/coming-soon" className="link-underline shrink-0 text-label uppercase">
          See all
        </Link>
      </div>
      <ProductGrid products={products} inventory={inventory} drops={drops} />
    </section>
  );
}
