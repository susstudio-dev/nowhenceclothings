import Link from 'next/link';
import { Accordion, Image } from '@/components/ui';
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

function CtaLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-[44px] items-center bg-ink px-6 text-sm uppercase tracking-widest text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {label}
    </Link>
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
    case 'hero':
      return (
        <section className="relative isolate min-h-[85vh] overflow-hidden bg-ink text-paper">
          {b.videoUrl ? (
            <video
              className="absolute inset-0 -z-10 h-full w-full object-cover motion-reduce:hidden"
              src={b.videoUrl}
              autoPlay
              muted
              loop
              playsInline
              aria-hidden
            />
          ) : null}
          {b.media && (
            <div className="absolute inset-0 -z-20">
              <Image media={b.media} priority={priority} sizes="100vw" className="h-full w-full object-cover" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent" aria-hidden />
          <div className="relative mx-auto flex min-h-[85vh] max-w-7xl flex-col justify-end gap-4 px-4 pb-16 md:px-8">
            {priority ? <h1 className="max-w-3xl font-display text-4xl md:text-6xl">{b.heading}</h1> : <h2 className="max-w-3xl font-display text-4xl md:text-6xl">{b.heading}</h2>}
            {b.subheading && <p className="max-w-xl text-lg">{b.subheading}</p>}
            {b.cta && (
              <div>
                <Link href={b.cta.href} className="inline-flex min-h-[44px] items-center bg-paper px-6 text-sm uppercase tracking-widest text-ink">
                  {b.cta.label}
                </Link>
              </div>
            )}
          </div>
        </section>
      );
    case 'richText':
      return (
        <section className="mx-auto max-w-2xl px-4 py-12">
          <Markdown source={b.markdown} />
        </section>
      );
    case 'image':
      return (
        <figure className={b.layout === 'full' ? 'my-12' : 'mx-auto my-12 max-w-4xl px-4'}>
          <Image media={b.media} sizes={b.layout === 'full' ? '100vw' : '(min-width: 1024px) 896px, 100vw'} className="h-auto w-full" />
          {b.caption && <figcaption className="mt-2 px-4 text-xs text-muted">{b.caption}</figcaption>}
        </figure>
      );
    case 'gallery':
      return (
        <section className="mx-auto my-12 grid max-w-7xl grid-cols-2 gap-2 px-4 md:grid-cols-3 md:px-8">
          {b.items.map((m) => (
            <Image key={m.id} media={m} sizes="(min-width: 768px) 33vw, 50vw" className="h-full w-full object-cover" />
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
      return (
        <section className="mx-auto max-w-7xl px-4 py-16 md:px-8">
          {b.heading && <h2 className="mb-8 font-display text-2xl">{b.heading}</h2>}
          <ProductGrid products={products} inventory={ctx.inventory} drops={ctx.catalogue.drops} />
        </section>
      );
    }
    case 'featuredDrop': {
      const drop = ctx.catalogue.drops.find((d) => d.id === b.dropId);
      if (!drop) return null;
      const upcoming = new Date(drop.releaseAt).getTime() > (ctx.now ?? new Date()).getTime();
      const items = active.filter((p) => p.dropId === drop.id).slice(0, 4);
      return (
        <section className="mx-auto grid max-w-7xl gap-8 px-4 py-16 md:grid-cols-2 md:px-8">
          {drop.heroMedia && <Image media={drop.heroMedia} sizes="(min-width: 768px) 50vw, 100vw" className="aspect-[4/5] h-auto w-full object-cover" />}
          <div className="flex flex-col justify-center gap-4">
            <p className="text-xs uppercase tracking-widest text-muted">{upcoming ? 'Upcoming drop' : 'Out now'}</p>
            <h2 className="font-display text-4xl">{drop.name}</h2>
            {drop.description && <p className="max-w-md">{drop.description}</p>}
            {upcoming && <Countdown releaseAt={drop.releaseAt} />}
            <div>
              <CtaLink href={`/drops/${drop.slug}`} label={upcoming ? 'Preview the drop' : 'Shop the drop'} />
            </div>
            {!drop.heroMedia && items.length > 0 && (
              <ProductGrid products={items} inventory={ctx.inventory} drops={ctx.catalogue.drops} />
            )}
          </div>
        </section>
      );
    }
    case 'categoryTiles': {
      const cats = (b.categoryIds.length
        ? b.categoryIds.map((id) => ctx.catalogue.categories.find((c) => c.id === id))
        : ctx.catalogue.categories
      ).filter((c): c is NonNullable<typeof c> => !!c);
      return (
        <section className="mx-auto max-w-7xl px-4 py-16 md:px-8">
          {b.heading && <h2 className="mb-8 font-display text-2xl">{b.heading}</h2>}
          <ul className="grid gap-4 sm:grid-cols-2">
            {cats.map((c) => {
              const fallback = active.find((p) => p.categoryId === c.id)?.colours[0]?.images[0];
              const media = c.image ?? fallback;
              return (
                <li key={c.id}>
                  <Link href={`/shop/${c.slug}`} className="group relative block aspect-[4/5] overflow-hidden bg-line/40 sm:aspect-[3/4]">
                    {media && (
                      <Image media={media} alt="" sizes="(min-width: 640px) 50vw, 100vw" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none" />
                    )}
                    <span className="absolute bottom-4 left-4 bg-paper px-4 py-2 text-sm uppercase tracking-widest">{c.name}</span>
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
        <section className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-16 md:grid-cols-2 md:px-8">
          {b.media && <Image media={b.media} sizes="(min-width: 768px) 50vw, 100vw" className="aspect-[4/5] h-auto w-full object-cover" />}
          <div className="space-y-4">
            <h2 className="font-display text-3xl">{b.heading}</h2>
            <Markdown source={b.body} />
            {b.cta && <CtaLink href={b.cta.href} label={b.cta.label} />}
          </div>
        </section>
      );
    case 'quote':
      return (
        <figure className="mx-auto max-w-3xl px-4 py-16 text-center">
          <blockquote className="font-display text-2xl md:text-3xl">&ldquo;{b.text}&rdquo;</blockquote>
          {b.attribution && <figcaption className="mt-4 text-sm text-muted">{b.attribution}</figcaption>}
        </figure>
      );
    case 'faq':
      return (
        <section className="mx-auto max-w-2xl px-4 py-12">
          <Accordion items={b.items.map((it, i) => ({ id: `${b.id}-${i}`, title: it.q, content: <Markdown source={it.a} /> }))} />
        </section>
      );
    case 'newsletter':
      return (
        <section className="border-t border-line px-4 py-16 text-center">
          <h2 className="font-display text-2xl">{b.heading}</h2>
          {b.body && <p className="mx-auto mt-2 max-w-md text-muted">{b.body}</p>}
          <div className="mt-6">
            <NewsletterForm />
          </div>
        </section>
      );
    default:
      return null;
  }
}

