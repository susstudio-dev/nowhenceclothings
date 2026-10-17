import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArticleView, articleMetadata, publishedArticles } from '@/components/shop/Editorial';
import { getInventory } from '@/lib/catalogue';
import { getShopCatalogue } from '@/lib/launches-server';
import { getSiteContent } from '@/lib/content';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

async function find(slug: string) {
  const content = await getSiteContent();
  return publishedArticles(content.lookbook).find((a) => a.slug === slug) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await find((await params).slug);
  return a ? articleMetadata(a, '/lookbook') : {};
}

/** Lookbook entry (S8): rendered from admin content blocks. */
export default async function LookbookEntry({ params }: Props) {
  const article = await find((await params).slug);
  if (!article) notFound();
  const [catalogue, inventory] = await Promise.all([getShopCatalogue(), getInventory()]);
  return <ArticleView article={article} ctx={{ catalogue, inventory }} backHref="/lookbook" backLabel="Lookbook" />;
}
