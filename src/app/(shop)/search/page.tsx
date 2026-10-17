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
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
      <h1 className="mb-6 font-display text-4xl">Search</h1>
      <SearchClient index={buildSearchIndex(products.filter(isIndexable), names)} initialQuery={Array.isArray(q) ? q[0] : q ?? ''} />
    </div>
  );
}
