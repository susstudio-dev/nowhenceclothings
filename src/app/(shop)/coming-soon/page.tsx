import type { Metadata } from 'next';
import { ProductGrid } from '@/components/shop/ProductCard';
import { getCatalogue, getInventory } from '@/lib/catalogue';
import { getSettings } from '@/lib/content';
import { productsFor, publicDrops } from '@/lib/launches-server';
import { buildMetadata, plainText } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { launches } = await getSettings();
  return buildMetadata({
    title: launches.page.title,
    path: '/coming-soon',
    description: plainText(launches.page.intro),
    descriptionSupport: 'First looks at what Nowhence is making next. Leave your email to hear the moment each piece lands.',
  });
}

/** A10 /coming-soon: every piece flagged "show on the coming-soon page". */
export default async function ComingSoonPage() {
  const [raw, inventory, settings] = await Promise.all([getCatalogue(), getInventory(), getSettings()]);
  const products = productsFor(raw, settings.launches, 'comingSoonPage');
  const { title, intro } = settings.launches.page;
  return (
    <div className="container-page pb-section pt-10 md:pt-16">
      <header className="mb-10 grid gap-4 border-b border-line pb-8 md:mb-14 md:grid-cols-12 md:items-end">
        <div className="md:col-span-7">
          <p className="eyebrow">In the workroom</p>
          <h1 className="mt-4 text-balance font-display text-display font-light">{title}</h1>
        </div>
        {intro && <p className="max-w-sm text-small text-ink-soft md:col-span-4 md:col-start-9 md:justify-self-end">{intro}</p>}
      </header>
      <ProductGrid products={products} inventory={inventory} drops={publicDrops(raw.drops)} empty="Nothing announced yet. Check back soon." />
    </div>
  );
}
