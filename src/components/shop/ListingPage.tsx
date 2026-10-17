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
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
        <header className="mb-8">
          <h1 className="font-display text-4xl">{title}</h1>
          {intro && <p className="mt-2 max-w-xl text-muted">{intro}</p>}
        </header>
        <ListingFilters basePath={basePath} params={params} filters={filters} sort={sort} facets={facets(products)} count={shown.length} />
        <ProductGrid products={shown} inventory={inventory} drops={drops} empty="No pieces match these filters." />
      </div>
    </>
  );
}
