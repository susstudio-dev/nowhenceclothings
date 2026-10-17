import type { Metadata } from 'next';
import { ArticleIndex, publishedArticles } from '@/components/shop/Editorial';
import { getSiteContent } from '@/lib/content';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({
  title: 'Lookbook',
  path: '/lookbook',
  description: 'The Nowhence lookbook: seasons in pictures. Heavyweight unisex clothing, worn and photographed in India.',
});

export default async function LookbookIndex() {
  const content = await getSiteContent();
  return <ArticleIndex title="Lookbook" intro="Seasons, in pictures." base="/lookbook" articles={publishedArticles(content.lookbook)} />;
}
