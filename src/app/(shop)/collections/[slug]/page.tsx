import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Image } from '@/components/ui';
import { ListingPage } from '@/components/shop/ListingPage';
import { getActiveProducts, getCatalogue, getInventory } from '@/lib/catalogue';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const col = (await getCatalogue()).collections.find((c) => c.slug === slug);
  if (!col) return {};
  return {
    title: col.seo.title ?? col.name,
    description: col.seo.description ?? (col.description || undefined),
    alternates: { canonical: `/collections/${col.slug}` },
  };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const [{ slug }, sp, catalogue, products, inventory] = await Promise.all([
    params,
    searchParams,
    getCatalogue(),
    getActiveProducts(),
    getInventory(),
  ]);
  const col = catalogue.collections.find((c) => c.slug === slug);
  if (!col) notFound();
  return (
    <ListingPage
      title={col.name}
      intro={col.description}
      basePath={`/collections/${col.slug}`}
      params={sp}
      products={products.filter((p) => p.collectionIds.includes(col.id))}
      inventory={inventory}
      drops={catalogue.drops}
      hero={
        col.heroMedia ? (
          <Image media={col.heroMedia} priority sizes="100vw" className="max-h-[60vh] w-full object-cover" />
        ) : undefined
      }
    />
  );
}
