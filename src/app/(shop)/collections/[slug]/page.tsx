import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Image } from '@/components/ui';
import { ListingPage } from '@/components/shop/ListingPage';
import { getCatalogue, getInventory } from '@/lib/catalogue';
import { getStorefrontProducts, publicDrops } from '@/lib/launches-server';
import { isPlaceholderMedia } from '@/lib/brand-defaults';
import { breadcrumbLd, jsonLdScript } from '@/lib/jsonld';
import { buildMetadata, paths } from '@/lib/seo';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const col = (await getCatalogue()).collections.find((c) => c.slug === slug);
  if (!col) return {};
  return buildMetadata({
    title: `The ${col.name} collection: premium unisex clothing`,
    path: paths.collection(col.slug),
    seo: col.seo,
    description: col.description,
    descriptionSupport: `Shop the ${col.name} collection at Nowhence: heavyweight unisex cotton, designed in India.`,
    image: isPlaceholderMedia(col.heroMedia) ? undefined : col.heroMedia,
  });
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const [{ slug }, sp, catalogue, products, inventory] = await Promise.all([
    params,
    searchParams,
    getCatalogue(),
    getStorefrontProducts('shop'),
    getInventory(),
  ]);
  const col = catalogue.collections.find((c) => c.slug === slug);
  if (!col) notFound();
  const crumbs = jsonLdScript(
    breadcrumbLd([
      { name: 'Home', path: paths.home() },
      { name: 'Shop', path: paths.shop() },
      { name: col.name, path: paths.collection(col.slug) },
    ]),
  );
  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: crumbs }} />
    <ListingPage
      title={col.name}
      intro={col.description}
      basePath={`/collections/${col.slug}`}
      params={sp}
      products={products.filter((p) => p.collectionIds.includes(col.id))}
      inventory={inventory}
      drops={publicDrops(catalogue.drops)}
      hero={
        col.heroMedia ? (
          <Image media={col.heroMedia} priority sizes="100vw" className="max-h-[60vh] w-full object-cover" />
        ) : undefined
      }
    />
    </>
  );
}
