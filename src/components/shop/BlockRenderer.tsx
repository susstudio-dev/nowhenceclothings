import Link from 'next/link';
import { Accordion, Image } from '@/components/ui';
import { ButtonLink } from '@/components/ui/ButtonLink';
import type { Block } from '@/lib/schemas/site-content';
import type { CatalogueDoc } from '@/lib/schemas/catalogue';
import type { InventoryDoc } from '@/lib/schemas/inventory';
import { Countdown } from './Countdown';
import { Markdown } from './Markdown';
import { NewsletterForm } from './NewsletterForm';
import { ProductGrid } from './ProductCard';

export interface BlockContext {
  catalogue: CatalogueDoc;
  inventory: InventoryDoc;
  now?: Date;
}

function CtaLink({ href, label, variant = 'primary' }: { href: string; label: string; variant?: 'primary' | 'secondary' | 'inverse' }) {
  return (
    <ButtonLink href={href} variant={variant}>
      {label}
    </ButtonLink>
  );
}

function SectionHead({ heading, href, linkLabel }: { heading?: string; href?: string; linkLabel?: string }) {
  if (!heading) return null;
  return (
    <div className="mb-8 flex items-end justify-between gap-6 border-b border-line pb-4 md:mb-10">
      <h2 className="text-balance font-display text-display-sm font-light">{heading}</h2>
      {href && <Link href={href} className="link-underline shrink-0 text-label uppercase">{linkLabel ?? 'View all'}</Link>}
    </div>
  );
}

/** Renders admin content blocks for home, lookbook, journal (S1, S8). */
export function BlockRenderer({ blocks, ctx, firstIsHero = true }: { blocks: Block[]; ctx: BlockContext; firstIsHero?: boolean }) {
  return (
    <>
      {blocks.map((b, i) => (
        <BlockView key={b.id} block={b} ctx={ctx} priority={firstIsHero && i === 0} />
      ))}
    </>
  );
}

function BlockView({ block: b, ctx, priority }: { block: Block; ctx: BlockContext; priority: boolean }) {
  const active = ctx.catalogue.products.filter((p) => p.status === 'active');
  switch (b.type) {
    case 'hero': {
      const H = priority ? 'h1' : 'h2';
      return (
        // data-chrome-hero: the header overlays this photograph when it leads the page.
        <section data-chrome-hero="" className="relative isolate flex min-h-[calc(100svh-6rem)] items-end overflow-hidden bg-ink text-paper md:min-h-[88vh]">
          {b.media && (
            <div className="absolute inset-0 -z-20">
              <Image media={b.media} priority={priority} sizes="100vw" className="h-full w-full object-cover" />
            </div>
          )}
          {b.videoUrl ? (
            <video className="absolute inset-0 -z-10 h-full w-full object-cover motion-reduce:hidden" src={b.videoUrl} autoPlay muted loop playsInline aria-hidden />
          ) : null}
          {/* Flat ink scrim; never a box behind the type. */}
          <div className="absolute inset-0 -z-10 bg-ink/25" aria-hidden />
          <div className="container-page grid w-full gap-6 pb-12 pt-32 md:grid-cols-12 md:items-end md:pb-16">
            <div className="md:col-span-8">
              <H className="text-balance font-display text-hero font-light">{b.heading}</H>
            </div>
            <div className="space-y-6 md:col-span-4 md:justify-self-end md:text-right">
              {b.subheading && <p className="max-w-xs text-small text-paper/85 md:ml-auto">{b.subheading}</p>}
              {b.cta && <CtaLink href={b.cta.href} label={b.cta.label} variant="inverse" />}
            </div>
          </div>
        </section>
      );
    }
    case 'richText':
      return (
        <section className="container-page py-12">
          <div className="mx-auto max-w-prose">
            <Markdown source={b.markdown} />
          </div>
        </section>
      );
    case 'image':
      return (
        <figure className={b.layout === 'full' ? 'my-section' : 'container-page my-section'}>
          <Image media={b.media} sizes={b.layout === 'full' ? '100vw' : '(min-width: 1024px) 1200px, 100vw'} className="h-auto w-full" />
          {b.caption && <figcaption className="mt-3 text-caption text-muted">{b.caption}</figcaption>}
        </figure>
      );
    case 'gallery':
      return (
        <section className="container-page my-section grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4">
          {b.items.map((m) => (
            <Image key={m.id} media={m} sizes="(min-width: 768px) 33vw, 50vw" className="aspect-garment h-full w-full object-cover" />
          ))}
        </section>
      );
    case 'productGrid': {
      let products = b.productIds.length
        ? b.productIds.map((id) => active.find((p) => p.id === id)).filter((p): p is (typeof active)[number] => !!p)
        : b.collectionId
          ? active.filter((p) => p.collectionIds.includes(b.collectionId!))
          : active;
      products = products.slice(0, b.limit);
      if (!products.length) return null;
      return (
        <section className="container-page py-section">
          <SectionHead heading={b.heading} href="/shop" linkLabel="Shop all" />
          <ProductGrid products={products} inventory={ctx.inventory} drops={ctx.catalogue.drops} />
        </section>
      );
    }
    case 'featuredDrop': {
      const drop = ctx.catalogue.drops.find((d) => d.id === b.dropId);
      if (!drop) return null;
      const upcoming = new Date(drop.releaseAt).getTime() > (ctx.now ?? new Date()).getTime();
      const items = active.filter((p) => p.dropId === drop.id).slice(0, 3);
      return (
        <section className="container-page py-section">
          <div className="grid gap-10 md:grid-cols-12 md:gap-8">
            <div className="md:col-span-4 md:pr-8">
              <p className="care-tag">{upcoming ? 'Upcoming drop' : 'Out now'}</p>
              <h2 className="mt-6 text-balance font-display text-display font-light">{drop.name}</h2>
              {drop.description && <p className="mt-4 max-w-sm text-small text-ink-soft">{drop.description}</p>}
              {upcoming && <Countdown releaseAt={drop.releaseAt} className="mt-8" />}
              <div className="mt-8">
                <CtaLink href={`/drops/${drop.slug}`} label={upcoming ? 'Preview the drop' : 'Shop the drop'} variant="secondary" />
              </div>
            </div>
            <div className="md:col-span-8">
              {drop.heroMedia ? (
                <Image media={drop.heroMedia} sizes="(min-width: 768px) 66vw, 100vw" className="aspect-[4/5] h-auto w-full object-cover md:aspect-[3/2]" />
              ) : items.length > 0 ? (
                <ProductGrid products={items} inventory={ctx.inventory} drops={ctx.catalogue.drops} cols={3} />
              ) : null}
            </div>
          </div>
        </section>
      );
    }
    case 'categoryTiles': {
      const cats = (b.categoryIds.length
        ? b.categoryIds.map((id) => ctx.catalogue.categories.find((c) => c.id === id))
        : ctx.catalogue.categories
      ).filter((c): c is NonNullable<typeof c> => !!c);
      if (!cats.length) return null;
      return (
        <section className="container-page py-section">
          <SectionHead heading={b.heading} />
          <ul className="grid grid-cols-2 gap-3 md:gap-4">
            {cats.map((c) => {
              const media = c.image ?? active.find((p) => p.categoryId === c.id)?.colours[0]?.images[0];
              return (
                <li key={c.id}>
                  <Link href={`/shop/${c.slug}`} className="group block">
                    <div className="relative aspect-garment overflow-hidden bg-paper-deep">
                      {media && (
                        <Image media={media} alt="" sizes="50vw" className="h-full w-full object-cover transition-transform duration-slow ease-out group-hover:scale-[1.02] motion-reduce:transition-none" />
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between border-b border-line pb-3">
                      <span className="font-display text-h4 font-light">{c.name}</span>
                      <span aria-hidden className="text-label uppercase text-muted transition-transform duration-fast group-hover:translate-x-1">Shop</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      );
    }
    case 'story':
      return (
        <section className="container-page py-section">
          <div className={b.media ? 'grid items-center gap-10 md:grid-cols-12' : 'mx-auto max-w-prose text-center'}>
            {b.media && <Image media={b.media} sizes="(min-width: 768px) 50vw, 100vw" className="aspect-[4/5] h-auto w-full object-cover md:col-span-6" />}
            <div className={b.media ? 'space-y-6 md:col-span-5 md:col-start-8' : 'space-y-6'}>
              <h2 className="text-balance font-display text-display-sm font-light">{b.heading}</h2>
              <div className="text-ink-soft"><Markdown source={b.body} /></div>
              {b.cta && <CtaLink href={b.cta.href} label={b.cta.label} variant="secondary" />}
            </div>
          </div>
        </section>
      );
    case 'quote':
      return (
        <figure className="container-page py-section text-center">
          <blockquote className="mx-auto max-w-3xl text-balance font-display text-display-sm font-light">&ldquo;{b.text}&rdquo;</blockquote>
          {b.attribution && <figcaption className="mt-6 text-label uppercase text-muted">{b.attribution}</figcaption>}
        </figure>
      );
    case 'faq':
      return (
        <section className="container-page py-12">
          <div className="mx-auto max-w-prose">
            <Accordion items={b.items.map((it, i) => ({ id: `${b.id}-${i}`, title: it.q, content: <Markdown source={it.a} /> }))} />
          </div>
        </section>
      );
    case 'newsletter':
      return (
        <section className="container-page border-t border-line py-section">
          <div className="mx-auto max-w-md text-center">
            <h2 className="font-display text-display-sm font-light">{b.heading}</h2>
            {b.body && <p className="mt-3 text-small text-muted">{b.body}</p>}
            <div className="mt-8">
              <NewsletterForm />
            </div>
          </div>
        </section>
      );
    default:
      return null;
  }
}
