import Link from 'next/link';
import { requireAdmin } from '@/lib/guard';
import { getCatalogue, getInventory } from '@/lib/catalogue';
import { readDraft } from '@/lib/admin/store';
import { BlockRenderer } from '@/components/shop/BlockRenderer';

export const metadata = { title: 'Preview draft' };

/** Renders the DRAFT with the storefront's block renderer (A6 preview). */
export default async function PreviewPage({ searchParams }: { searchParams: Promise<{ page?: string; article?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [draft, catalogue, inventory] = await Promise.all([readDraft(), getCatalogue(), getInventory()]);
  const ctx = { catalogue, inventory };
  const page = sp.page ? draft.pages[sp.page] : undefined;
  const article = sp.article
    ? [...draft.lookbook, ...draft.journal].find((a) => a.slug === sp.article)
    : undefined;
  const blocks = article?.blocks ?? page?.blocks ?? draft.home.blocks;
  const title = article?.title ?? page?.title ?? 'Home';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 border border-accent p-3 text-sm">
        <b>Draft preview</b> — {title}. Not live until published.
        <Link href="/admin/content" className="underline">
          Back to editor
        </Link>
      </div>
      <nav aria-label="Preview pages" className="flex flex-wrap gap-3 text-xs">
        <Link href="/admin/content/preview" className="underline">
          Home
        </Link>
        {Object.keys(draft.pages).map((slug) => (
          <Link key={slug} href={`/admin/content/preview?page=${slug}`} className="underline">
            {slug}
          </Link>
        ))}
        {[...draft.lookbook, ...draft.journal].map((a) => (
          <Link key={a.slug} href={`/admin/content/preview?article=${a.slug}`} className="underline">
            {a.title}
            {a.status === 'draft' ? ' (draft)' : ''}
          </Link>
        ))}
      </nav>
      {draft.announcement.enabled && <p className="bg-ink px-4 py-2 text-center text-xs text-paper">{draft.announcement.text}</p>}
      <div className="border border-line">
        <BlockRenderer blocks={blocks} ctx={ctx} />
      </div>
    </div>
  );
}
