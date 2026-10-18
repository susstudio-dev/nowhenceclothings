import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ListingPage } from '@/components/shop/ListingPage';
import { getCatalogue, getInventory } from '@/lib/catalogue';
import { getStorefrontProducts, publicDrops } from '@/lib/launches-server';
import { breadcrumbLd, jsonLdScript } from '@/lib/jsonld';
import { buildMetadata, paths } from '@/lib/seo';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ category: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const cat = (await getCatalogue()).categories.find((c) => c.slug === category);
  if (!cat) return {};
  return buildMetadata({
    title: `${cat.name}: premium unisex clothing`,
    path: paths.category(cat.slug),
    seo: cat.seo,
    description: cat.description,
    descriptionSupport: `Shop all ${cat.name.toLowerCase()} at Nowhence: heavyweight unisex cotton, designed in India.`,
    image: cat.image,
  });
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ category }, sp, catalogue, products, inventory] = await Promise.all([
    params,
    searchParams,
    getCatalogue(),
    getStorefrontProducts('shop'),
    getInventory(),
  ]);
  const cat = catalogue.categories.find((c) => c.slug === category);
  if (!cat) notFound();
  const crumbs = jsonLdScript(
    breadcrumbLd([
      { name: 'Home', path: paths.home() },
      { name: 'Shop', path: paths.shop() },
      { name: cat.name, path: paths.category(cat.slug) },
    ]),
  );
  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: crumbs }} />
    <ListingPage
      title={cat.name}
      intro={cat.description}
      basePath={`/shop/${cat.slug}`}
      params={sp}
      products={products.filter((p) => p.categoryId === cat.id)}
      inventory={inventory}
      drops={publicDrops(catalogue.drops)}
    />
    </>
  );
}
