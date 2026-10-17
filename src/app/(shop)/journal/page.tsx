import type { Metadata } from 'next';
import { ArticleIndex, publishedArticles } from '@/components/shop/Editorial';
import { getSiteContent } from '@/lib/content';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({
  title: 'Journal',
  path: '/journal',
  description: 'Notes from the Nowhence studio: cloth, fit and the thinking behind each small run.',
});

export default async function JournalIndex() {
  const content = await getSiteContent();
  return <ArticleIndex title="Journal" intro="Notes from the studio." base="/journal" articles={publishedArticles(content.journal)} />;
}
