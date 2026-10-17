import type { Metadata } from 'next';
import { SearchClient } from '@/components/shop/SearchClient';
import { buildSearchIndex } from '@/components/shop/merch';
import { getCatalogue } from '@/lib/catalogue';
import { isIndexable } from '@/lib/launches';
import { getStorefrontProducts } from '@/lib/launches-server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Search', robots: { index: false, follow: true } };

/** Search (S10): index built from the catalogue doc, matched client-side. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const [{ q }, catalogue, products] = await Promise.all([searchParams, getCatalogue(), getStorefrontProducts('shop')]);
  const names = Object.fromEntries(catalogue.categories.map((c) => [c.id, c.name]));
  return (
    <div className="container-page pb-section pt-10 md:pt-16">
      <h1 className="mb-8 font-display text-display font-light">Search</h1>
      <SearchClient index={buildSearchIndex(products.filter(isIndexable), names)} initialQuery={Array.isArray(q) ? q[0] : q ?? ''} />
    </div>
  );
}
