import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Accordion, type AccordionItem } from '@/components/ui';
import { Markdown } from '@/components/shop/Markdown';
import { ProductGrid } from '@/components/shop/ProductCard';
import { ProductView } from '@/components/shop/ProductView';
import { completeTheLook, dropFor, isSoldOut, stockMap, variantPrice } from '@/components/shop/merch';
import { getInventory, isReleased } from '@/lib/catalogue';
import { isIndexable } from '@/lib/launches';
import { getStorefrontCatalogue } from '@/lib/launches-server';
import { getSettings } from '@/lib/content';
import { formatPaise } from '@/lib/money';
import { returnsLabel } from '@/lib/static-pages';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  // A10: projected product only — hidden titles/images never reach metadata.
  const p = (await getStorefrontCatalogue()).products.find((x) => x.slug === slug);
  if (!p) return {};
  const img = p.seo.ogImage ?? p.colours[0]?.images[0];
  const ogUrl = img?.src ?? (img && img.widths.length ? `/media/${img.id}/${img.widths[img.widths.length - 1]}.webp` : undefined);
  return {
    title: p.seo.title ?? p.title,
    description: p.seo.description ?? p.description.slice(0, 160),
    alternates: { canonical: `/products/${p.slug}` },
    ...(isIndexable(p) ? {} : { robots: { index: false, follow: true } }),
    openGraph: { type: 'website', title: p.title, images: ogUrl ? [{ url: ogUrl, width: img!.width, height: img!.height, alt: img!.alt }] : undefined },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [catalogue, inventory, settings] = await Promise.all([getStorefrontCatalogue(), getInventory(), getSettings()]);
  const product = catalogue.products.find((p) => p.slug === slug);
  if (!product) notFound();
  const launch = product.launch;

  const drop = dropFor(product, catalogue.drops);
  const released = isReleased(product, catalogue.drops);
  const chart = catalogue.sizeCharts.find((c) => c.id === product.sizeChartId);
  const category = catalogue.categories.find((c) => c.id === product.categoryId);
  const related = completeTheLook(product, catalogue.products);
  const price = variantPrice(product);
  const site = 'https://nowhenceclothings.com';

  const jsonLd = [
    // A10: no Product JSON-LD while coming soon.
    isIndexable(product) && {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.title,
      description: product.description,
      sku: product.variants[0].sku,
      brand: { '@type': 'Brand', name: 'Nowhence' },
      image: product.colours.flatMap((c) => c.images.map((m) => m.src ?? `${site}/media/${m.id}/${m.widths.at(-1) ?? 0}.webp`)),
      offers: {
        '@type': 'Offer',
        url: `${site}/products/${product.slug}`,
        priceCurrency: 'INR',
        price: (price.amount / 100).toFixed(2),
        availability: launch.state === 'presale' || !released
          ? 'https://schema.org/PreOrder'
          : launch.state === 'sold_out' || isSoldOut(product, inventory)
            ? 'https://schema.org/OutOfStock'
            : 'https://schema.org/InStock',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Shop', item: `${site}/shop` },
        ...(category ? [{ '@type': 'ListItem', position: 2, name: category.name, item: `${site}/shop/${category.slug}` }] : []),
        { '@type': 'ListItem', position: category ? 3 : 2, name: product.title, item: `${site}/products/${product.slug}` },
      ],
    },
  ];

  const ship = settings.shipping;
  const details: (AccordionItem | false | '')[] = [
    product.fit && { id: 'fit', title: 'Fit', content: <Markdown source={product.fit} /> },
    product.fabric && { id: 'fabric', title: 'Fabric & care', content: <Markdown source={[product.fabric, product.care].filter(Boolean).join('\n\n')} /> },
    {
      id: 'shipping',
      title: 'Shipping & returns',
      content: (
        <div className="space-y-2">
          <p>
            Free shipping on orders above {formatPaise(ship.freeShippingThreshold)}; otherwise {formatPaise(ship.flatFee)}.
            {ship.eta && ` ${ship.eta}.`}
          </p>
          <p>
            {settings.returns.returnsAllowed || settings.returns.exchangesAllowed
              ? `${returnsLabel(settings.returns)} within ${settings.returns.windowDays} days.`
              : 'No returns or exchanges, except faulty pieces.'}{' '}
            <Link href="/returns" className="link-quiet">Read the policy</Link>.
          </p>
        </div>
      ),
    },
  ];
  const items = details.filter((x): x is AccordionItem => !!x);

  return (
    <div className="container-page pb-section pt-4 md:pt-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd.filter(Boolean)).replace(/</g, '\\u003c') }} />
      <nav aria-label="Breadcrumb" className="mb-4 hidden text-caption text-muted md:mb-6 md:block">
        <ol className="flex flex-wrap gap-2">
          <li><Link href="/shop" className="link-underline">Shop</Link> <span aria-hidden>/</span></li>
          {category && <li><Link href={`/shop/${category.slug}`} className="link-underline">{category.name}</Link> <span aria-hidden>/</span></li>}
          <li aria-current="page" className="text-ink">{product.title}</li>
        </ol>
      </nav>

      <ProductView
        product={product}
        stock={stockMap(product, inventory)}
        sizeChart={chart}
        upcomingReleaseAt={!released && drop && launch.state === 'available' ? drop.releaseAt : undefined}
        launch={launch}
        maxQty={settings.orders.maxQtyPerLine}
        eyebrow={category?.name}
        details={
          <>
            {product.description && launch.state !== 'coming_soon' && (
              <div className="mb-6 text-small text-ink-soft"><Markdown source={product.description} /></div>
            )}
            <Accordion items={items} />
            {drop && (
              <p className="mt-6 text-caption text-muted">
                Part of <Link href={`/drops/${drop.slug}`} className="link-underline text-ink">{drop.name}</Link>.
              </p>
            )}
          </>
        }
      />

      {related.length > 0 && (
        <section className="mt-section" aria-labelledby="ctl">
          <div className="mb-8 border-b border-line pb-4">
            <h2 id="ctl" className="font-display text-display-sm font-light">Complete the look</h2>
          </div>
          <ProductGrid products={related} inventory={inventory} drops={catalogue.drops} />
        </section>
      )}
    </div>
  );
}
