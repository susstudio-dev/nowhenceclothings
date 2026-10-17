import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Image } from '@/components/ui';
import { Countdown } from '@/components/shop/Countdown';
import { Markdown } from '@/components/shop/Markdown';
import { NotifyMe } from '@/components/shop/NotifyMe';
import { ProductGrid } from '@/components/shop/ProductCard';
import { getCatalogue, getInventory } from '@/lib/catalogue';
import { getStorefrontProducts, publicDrops } from '@/lib/launches-server';
import { isPlaceholderMedia } from '@/lib/brand-defaults';
import { buildMetadata, paths, plainText } from '@/lib/seo';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const drop = (await getCatalogue()).drops.find((d) => d.slug === slug);
  if (!drop) return {};
  return buildMetadata({
    title: drop.name,
    path: paths.drop(drop.slug),
    seo: drop.seo,
    description: plainText(drop.description),
    descriptionSupport: `${drop.name}: a Nowhence drop. Small runs of heavyweight unisex clothing, designed in India.`,
    image: isPlaceholderMedia(drop.heroMedia) ? undefined : drop.heroMedia,
  });
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
      <section className={'relative isolate ' + (drop.heroMedia ? 'bg-ink text-paper' : 'border-b border-line')}>
        {drop.heroMedia && (
          <>
            <div className="absolute inset-0 -z-20">
              <Image media={drop.heroMedia} priority sizes="100vw" className="h-full w-full object-cover" />
            </div>
            <div className="absolute inset-0 -z-10 bg-ink/30" aria-hidden />
          </>
        )}
        <div className={'container-page grid gap-8 pb-12 md:grid-cols-12 md:items-end ' + (drop.heroMedia ? 'min-h-[70vh] pt-32' : 'pt-16 md:pt-24')}>
          <div className="md:col-span-8">
            <p className="care-tag">{upcoming ? 'Upcoming drop' : 'Out now'}</p>
            <h1 className="mt-6 text-balance font-display text-hero font-light">{drop.name}</h1>
          </div>
          {upcoming && <Countdown releaseAt={drop.releaseAt} className="md:col-span-4 md:justify-self-end" />}
        </div>
      </section>
      <div className="container-page py-section">
        <div className="mb-section grid gap-10 md:grid-cols-12">
          {drop.description && <Markdown source={drop.description} className="max-w-prose space-y-4 text-ink-soft md:col-span-6" />}
          {upcoming && items[0] && (
            <div className="max-w-md md:col-span-5 md:col-start-8">
              <p className="mb-3 text-small">Get an email the moment {drop.name} goes live.</p>
              <NotifyMe sku={items[0].variants[0].sku} label="Notify me" />
            </div>
          )}
        </div>
        <div className="mb-8 border-b border-line pb-4">
          <h2 className="font-display text-display-sm font-light">{upcoming ? 'Preview' : 'The pieces'}</h2>
        </div>
        <ProductGrid products={items} inventory={inventory} drops={publicDrops(catalogue.drops)} empty="Pieces will be revealed soon." />
      </div>
    </>
  );
}
