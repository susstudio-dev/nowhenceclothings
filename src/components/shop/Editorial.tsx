import type { Metadata } from 'next';
import Link from 'next/link';
import { Image } from '@/components/ui';
import type { Article } from '@/lib/schemas/site-content';
import { BlockRenderer, type BlockContext } from './BlockRenderer';

/** Published articles, newest first. */
export function publishedArticles(list: Article[], now: Date = new Date()): Article[] {
  return list
    .filter((a) => a.status === 'published' && (!a.publishedAt || new Date(a.publishedAt).getTime() <= now.getTime()))
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
}

export function articleMetadata(a: Article, base: string): Metadata {
  return {
    title: a.seo.title ?? a.title,
    description: a.seo.description ?? (a.excerpt || undefined),
    alternates: { canonical: `${base}/${a.slug}` },
    openGraph: { type: 'article', title: a.title, publishedTime: a.publishedAt },
  };
}

export function ArticleIndex({ title, intro, base, articles }: { title: string; intro?: string; base: string; articles: Article[] }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
      <h1 className="font-display text-4xl">{title}</h1>
      {intro && <p className="mt-2 max-w-xl text-muted">{intro}</p>}
      {articles.length === 0 ? (
        <p className="py-16 text-center text-muted">Stories are on their way.</p>
      ) : (
        <ul className="mt-10 grid gap-x-6 gap-y-12 md:grid-cols-2">
          {articles.map((a, i) => (
            <li key={a.slug}>
              <Link href={`${base}/${a.slug}`} className="group block">
                <div className="aspect-[4/3] overflow-hidden bg-line/40">
                  {a.cover && (
                    <Image
                      media={a.cover}
                      alt=""
                      priority={i < 2}
                      sizes="(min-width: 768px) 50vw, 100vw"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
                    />
                  )}
                </div>
                <h2 className="mt-4 font-display text-2xl">{a.title}</h2>
                {a.publishedAt && (
                  <time dateTime={a.publishedAt} className="text-xs uppercase tracking-widest text-muted">
                    {new Date(a.publishedAt).toLocaleDateString('en-IN', { dateStyle: 'long' })}
                  </time>
                )}
                {a.excerpt && <p className="mt-2 text-muted">{a.excerpt}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ArticleView({ article, ctx, backHref, backLabel }: { article: Article; ctx: BlockContext; backHref: string; backLabel: string }) {
  const startsWithHero = article.blocks[0]?.type === 'hero';
  return (
    <article>
      {!startsWithHero && (
        <header className="mx-auto max-w-3xl px-4 pb-6 pt-12 text-center">
          <Link href={backHref} className="text-xs uppercase tracking-widest text-muted hover:underline">
            {backLabel}
          </Link>
          <h1 className="mt-4 font-display text-4xl md:text-5xl">{article.title}</h1>
          {article.publishedAt && (
            <time dateTime={article.publishedAt} className="mt-2 block text-sm text-muted">
              {new Date(article.publishedAt).toLocaleDateString('en-IN', { dateStyle: 'long' })}
            </time>
          )}
          {article.cover && <Image media={article.cover} priority sizes="100vw" className="mt-8 h-auto w-full" />}
        </header>
      )}
      <BlockRenderer blocks={article.blocks} ctx={ctx} firstIsHero={startsWithHero} />
    </article>
  );
}
