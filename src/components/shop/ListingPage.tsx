import type { ReactNode } from 'react';
import type { Drop, Product } from '@/lib/schemas/catalogue';
import type { InventoryDoc } from '@/lib/schemas/inventory';
import { ListingFilters } from './ListingFilters';
import { ProductGrid } from './ProductCard';
import { facets, filterProducts, parseListingParams, sortProducts } from './merch';

type Params = Record<string, string | string[] | undefined>;

/** Shared shop/category/collection listing (S2). Server component. */
export function ListingPage({
  title,
  intro,
  basePath,
  params,
  products,
  inventory,
  drops,
  hero,
}: {
  title: string;
  intro?: string;
  basePath: string;
  params: Params;
  products: Product[];
  inventory: InventoryDoc;
  drops: Drop[];
  hero?: ReactNode;
}) {
  const { filters, sort } = parseListingParams(params);
  const shown = sortProducts(filterProducts(products, inventory, filters), sort, inventory);
  return (
    <>
      {hero}
      <div className="container-page pb-section pt-10 md:pt-16">
        <header className="mb-10 grid gap-4 md:mb-14 md:grid-cols-12 md:items-end">
          <h1 className="text-balance font-display text-display font-light md:col-span-7">{title}</h1>
          {intro && <p className="max-w-sm text-small text-ink-soft md:col-span-4 md:col-start-9 md:justify-self-end">{intro}</p>}
        </header>
        <ListingFilters basePath={basePath} params={params} filters={filters} sort={sort} facets={facets(products)} count={shown.length} />
        <h2 className="sr-only">{title} pieces</h2>
        <ProductGrid products={shown} inventory={inventory} drops={drops} empty="No pieces match these filters." />
      </div>
    </>
  );
}
