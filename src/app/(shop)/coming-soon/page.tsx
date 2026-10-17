import type { Metadata } from 'next';
import { ProductGrid } from '@/components/shop/ProductCard';
import { getCatalogue, getInventory } from '@/lib/catalogue';
import { getSettings } from '@/lib/content';
import { productsFor, publicDrops } from '@/lib/launches-server';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { launches } = await getSettings();
  return { title: launches.page.title, description: launches.page.intro.slice(0, 160), alternates: { canonical: '/coming-soon' } };
}

/** A10 /coming-soon: every piece flagged "show on the coming-soon page". */
export default async function ComingSoonPage() {
  const [raw, inventory, settings] = await Promise.all([getCatalogue(), getInventory(), getSettings()]);
  const products = productsFor(raw, settings.launches, 'comingSoonPage');
  const { title, intro } = settings.launches.page;
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
      <header className="mb-10 max-w-2xl">
        <h1 className="font-display text-4xl">{title}</h1>
        {intro && <p className="mt-4 text-muted">{intro}</p>}
      </header>
      <ProductGrid products={products} inventory={inventory} drops={publicDrops(raw.drops)} empty="Nothing announced yet. Check back soon." />
    </div>
  );
}
