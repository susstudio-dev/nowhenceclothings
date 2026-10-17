import type { Metadata } from 'next';
import Link from 'next/link';
import { Image } from '@/components/ui';
import type { Article } from '@/lib/schemas/site-content';
import { buildMetadata } from '@/lib/seo';
import { BlockRenderer, type BlockContext } from './BlockRenderer';

/** Published articles, newest first. */
export function publishedArticles(list: Article[], now: Date = new Date()): Article[] {
  return list
    .filter((a) => a.status === 'published' && (!a.publishedAt || new Date(a.publishedAt).getTime() <= now.getTime()))
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
}

export function articleMetadata(a: Article, base: string): Metadata {
  return buildMetadata({
    title: a.title,
    path: `${base}/${a.slug}`,
    seo: a.seo,
    description: a.excerpt,
    image: a.cover,
    type: 'article',
    publishedTime: a.publishedAt,
    modifiedTime: a.updatedAt,
  });
}

export function ArticleIndex({ title, intro, base, articles }: { title: string; intro?: string; base: string; articles: Article[] }) {
  return (
    <div className="container-page pb-section pt-10 md:pt-16">
      <header className="grid gap-4 border-b border-line pb-8 md:grid-cols-12 md:items-end">
        <h1 className="text-balance font-display text-display font-light md:col-span-7">{title}</h1>
        {intro && <p className="max-w-sm text-small text-ink-soft md:col-span-4 md:col-start-9 md:justify-self-end">{intro}</p>}
      </header>
      {articles.length === 0 ? (
        <p className="py-24 text-center font-display text-h4 font-light text-muted">Stories are on their way.</p>
      ) : (
        <ul className="mt-10 grid gap-x-6 gap-y-14 md:grid-cols-2">
          {articles.map((a, i) => (
            <li key={a.slug}>
              <Link href={`${base}/${a.slug}`} className="group block">
                <div className="aspect-[4/3] overflow-hidden bg-paper-deep">
                  {a.cover && (
                    <Image
                      media={a.cover}
                      alt=""
                      priority={i < 2}
                      sizes="(min-width: 768px) 50vw, 100vw"
                      className="h-full w-full object-cover transition-transform duration-slow ease-out group-hover:scale-[1.02] motion-reduce:transition-none"
                    />
                  )}
                </div>
                <h2 className="mt-5 text-balance font-display text-h3 font-light">{a.title}</h2>
                {a.publishedAt && (
                  <time dateTime={a.publishedAt} className="mt-2 block text-label uppercase text-muted">
                    {new Date(a.publishedAt).toLocaleDateString('en-IN', { dateStyle: 'long' })}
                  </time>
                )}
                {a.excerpt && <p className="mt-3 max-w-prose text-small text-ink-soft">{a.excerpt}</p>}
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
        <header className="container-page pb-6 pt-12 text-center md:pt-20">
          <Link href={backHref} className="link-underline text-label uppercase text-muted">
            {backLabel}
          </Link>
          <h1 className="mx-auto mt-6 max-w-3xl text-balance font-display text-display font-light">{article.title}</h1>
          {article.publishedAt && (
            <time dateTime={article.publishedAt} className="mt-4 block text-caption text-muted">
              {new Date(article.publishedAt).toLocaleDateString('en-IN', { dateStyle: 'long' })}
            </time>
          )}
          {article.cover && <Image media={article.cover} priority sizes="100vw" className="mt-12 h-auto w-full" />}
        </header>
      )}
      <BlockRenderer blocks={article.blocks} ctx={ctx} firstIsHero={startsWithHero} />
    </article>
  );
}
