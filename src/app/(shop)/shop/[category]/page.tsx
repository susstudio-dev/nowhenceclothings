import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ListingPage } from '@/components/shop/ListingPage';
import { getCatalogue, getInventory } from '@/lib/catalogue';
import { getStorefrontProducts } from '@/lib/launches-server';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ category: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const cat = (await getCatalogue()).categories.find((c) => c.slug === category);
  if (!cat) return {};
  return {
    title: cat.seo.title ?? cat.name,
    description: cat.seo.description ?? (cat.description || undefined),
    alternates: { canonical: `/shop/${cat.slug}` },
  };
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
  return (
    <ListingPage
      title={cat.name}
      intro={cat.description}
      basePath={`/shop/${cat.slug}`}
      params={sp}
      products={products.filter((p) => p.categoryId === cat.id)}
      inventory={inventory}
      drops={catalogue.drops}
    />
  );
}
