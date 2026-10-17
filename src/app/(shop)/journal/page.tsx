import type { Metadata } from 'next';
import { ArticleIndex, publishedArticles } from '@/components/shop/Editorial';
import { getSiteContent } from '@/lib/content';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Journal', alternates: { canonical: '/journal' } };

export default async function JournalIndex() {
  const content = await getSiteContent();
  return <ArticleIndex title="Journal" intro="Notes from the studio." base="/journal" articles={publishedArticles(content.journal)} />;
}
