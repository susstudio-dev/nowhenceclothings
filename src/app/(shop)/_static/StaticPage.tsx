import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { getSettings, getSiteContent } from '@/lib/content';
import { faqLd, breadcrumbLd, jsonLdScript } from '@/lib/jsonld';
import { fillTemplate, parseMarkdown, type Inline, type MdBlock } from '@/lib/markdown';
import type { Block, Page } from '@/lib/schemas/site-content';
import { buildMetadata, paths, plainText } from '@/lib/seo';
import { resolveStaticPage, settingsVars, withReturnsTitle, type StaticSlug } from '@/lib/static-pages';

// Shared renderer for the S9 static pages (WS-E). Renders richText + faq
// blocks through the safe markdown tree; never injects raw HTML.

export async function loadStaticPage(slug: StaticSlug): Promise<{ page: Page; vars: Record<string, string> }> {
  const [content, settings] = await Promise.all([getSiteContent(), getSettings()]);
  const page = resolveStaticPage(slug, content.pages[slug]);
  return { page: slug === 'returns' ? withReturnsTitle(page, settings) : page, vars: settingsVars(settings) };
}

export async function staticPageMetadata(slug: StaticSlug): Promise<Metadata> {
  const { page, vars } = await loadStaticPage(slug);
  const firstText = page.blocks.find((b) => b.type === 'richText');
  return buildMetadata({
    title: page.title,
    path: paths.page(slug),
    seo: page.seo,
    description: firstText ? plainText(fillTemplate(firstText.markdown, vars)) : undefined,
  });
}

function renderInline(nodes: Inline[]): ReactNode[] {
  return nodes.map((n, i) => {
    switch (n.t) {
      case 'strong':
        return <strong key={i} className="font-medium">{n.v}</strong>;
      case 'em':
        return <em key={i}>{n.v}</em>;
      case 'link':
        return n.href.startsWith('/') ? (
          <Link key={i} href={n.href} className="underline underline-offset-4">{n.v}</Link>
        ) : (
          <a key={i} href={n.href} className="underline underline-offset-4">{n.v}</a>
        );
      default:
        return n.v;
    }
  });
}

function renderMd(blocks: MdBlock[], keyPrefix: string): ReactNode[] {
  return blocks.map((b, i) => {
    const key = `${keyPrefix}-${i}`;
    if (b.t === 'h') {
      if (b.level === 2) return <h1 key={key} className="mb-10 text-balance font-display text-display font-light">{renderInline(b.inline)}</h1>;
      if (b.level === 3) return <h2 key={key} className="mb-4 mt-12 border-t border-line pt-6 text-label uppercase">{renderInline(b.inline)}</h2>;
      return <h3 key={key} className="mb-2 mt-6 font-medium">{renderInline(b.inline)}</h3>;
    }
    if (b.t === 'p') return <p key={key} className="mb-4 text-small leading-relaxed text-ink-soft md:text-body">{renderInline(b.inline)}</p>;
    const Tag = b.t;
    return (
      <Tag key={key} className={`mb-4 space-y-2 pl-5 text-small leading-relaxed text-ink-soft md:text-body ${b.t === 'ul' ? 'list-disc' : 'list-decimal'}`}>
        {b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}
      </Tag>
    );
  });
}

function renderBlock(block: Block, vars: Record<string, string>): ReactNode {
  if (block.type === 'richText') return renderMd(parseMarkdown(fillTemplate(block.markdown, vars)), block.id);
  if (block.type === 'faq') {
    return (
      <div key={block.id} className="divide-y divide-line border-y border-line">
        {block.items.map((it, i) => (
          <details key={i} className="group py-4">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 text-small text-ink after:text-muted after:content-['+'] group-open:after:content-['–']">{it.q}</summary>
            <div className="pt-2 text-small leading-relaxed text-ink-soft">{renderMd(parseMarkdown(fillTemplate(it.a, vars)), `${block.id}-${i}`)}</div>
          </details>
        ))}
      </div>
    );
  }
  return null; // Other block types belong to the editorial renderer (WS-B).
}

export function StaticPageView({
  slug,
  page,
  vars,
  children,
}: {
  slug: StaticSlug;
  page: Page;
  vars: Record<string, string>;
  children?: ReactNode;
}) {
  const faqItems = page.blocks
    .filter((b): b is Extract<Block, { type: 'faq' }> => b.type === 'faq')
    .flatMap((b) => b.items.map((it) => ({ q: it.q, a: fillTemplate(it.a, vars) })));
  const ld: unknown[] = [breadcrumbLd([{ name: 'Home', path: '/' }, { name: page.title, path: paths.page(slug) }])];
  if (faqItems.length) ld.push(faqLd(faqItems));
  const hasHeading = page.blocks.some((b) => b.type === 'richText' && /^\s*#\s/.test(b.markdown));

  return (
    <article className="container-page max-w-[48rem] py-16 md:py-24">
      {!hasHeading && <h1 className="mb-10 text-balance font-display text-display font-light">{page.title}</h1>}
      {page.blocks.map((b) => <div key={b.id}>{renderBlock(b, vars)}</div>)}
      {children}
      {ld.map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(d) }} />
      ))}
    </article>
  );
}
