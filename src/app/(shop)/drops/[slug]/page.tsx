import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Image } from '@/components/ui';
import { Countdown } from '@/components/shop/Countdown';
import { Markdown } from '@/components/shop/Markdown';
import { NotifyMe } from '@/components/shop/NotifyMe';
import { ProductGrid } from '@/components/shop/ProductCard';
import { getCatalogue, getInventory } from '@/lib/catalogue';
import { getStorefrontProducts } from '@/lib/launches-server';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const drop = (await getCatalogue()).drops.find((d) => d.slug === slug);
  if (!drop) return {};
  return {
    title: drop.seo.title ?? drop.name,
    description: drop.seo.description ?? (drop.description.slice(0, 160) || undefined),
    alternates: { canonical: `/drops/${drop.slug}` },
  };
}

/** Drop page (S4): countdown + notify before release; shoppable grid after. */
export default async function DropPage({ params }: Props) {
  const { slug } = await params;
  const [catalogue, products, inventory] = await Promise.all([getCatalogue(), getStorefrontProducts('shop'), getInventory()]);
  const drop = catalogue.drops.find((d) => d.slug === slug);
  if (!drop) notFound();
  const items = products.filter((p) => p.dropId === drop.id);
  const upcoming = new Date(drop.releaseAt).getTime() > Date.now();

  return (
    <>
      <section className="relative isolate bg-ink text-paper">
        {drop.heroMedia && (
          <div className="absolute inset-0 -z-10 opacity-70">
            <Image media={drop.heroMedia} priority sizes="100vw" className="h-full w-full object-cover" />
          </div>
        )}
        <div className="mx-auto flex min-h-[60vh] max-w-7xl flex-col justify-end gap-6 px-4 py-16 md:px-8">
          <p className="text-xs uppercase tracking-widest">{upcoming ? 'Upcoming drop' : 'Out now'}</p>
          <h1 className="font-display text-5xl md:text-7xl">{drop.name}</h1>
          {upcoming && <Countdown releaseAt={drop.releaseAt} />}
        </div>
      </section>
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        {drop.description && <Markdown source={drop.description} className="mb-10 max-w-2xl space-y-4" />}
        {upcoming && items[0] && (
          <div className="mb-12 max-w-md">
            <p className="mb-3 text-sm">Get an email the moment {drop.name} goes live.</p>
            <NotifyMe sku={items[0].variants[0].sku} label="Notify me" />
          </div>
        )}
        <h2 className="mb-8 font-display text-2xl">{upcoming ? 'Preview' : 'The pieces'}</h2>
        <ProductGrid products={items} inventory={inventory} drops={catalogue.drops} empty="Pieces will be revealed soon." />
      </div>
    </>
  );
}
