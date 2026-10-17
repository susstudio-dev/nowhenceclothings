import type { Metadata } from 'next';
import { ArticleIndex, publishedArticles } from '@/components/shop/Editorial';
import { getSiteContent } from '@/lib/content';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Lookbook', alternates: { canonical: '/lookbook' } };

export default async function LookbookIndex() {
  const content = await getSiteContent();
  return <ArticleIndex title="Lookbook" intro="Seasons, in pictures." base="/lookbook" articles={publishedArticles(content.lookbook)} />;
}
