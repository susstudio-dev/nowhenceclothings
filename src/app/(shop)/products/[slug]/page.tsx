import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Accordion, type AccordionItem } from '@/components/ui';
import { Markdown } from '@/components/shop/Markdown';
import { ProductGrid } from '@/components/shop/ProductCard';
import { ProductView } from '@/components/shop/ProductView';
import { completeTheLook, dropFor, isSoldOut, stockMap, variantPrice } from '@/components/shop/merch';
import { getCatalogue, getInventory, getProductBySlug, isReleased } from '@/lib/catalogue';
import { getSettings } from '@/lib/content';
import { formatPaise } from '@/lib/money';
import { returnsLabel } from '@/lib/static-pages';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return {};
  const img = p.seo.ogImage ?? p.colours[0]?.images[0];
  const ogUrl = img?.src ?? (img && img.widths.length ? `/media/${img.id}/${img.widths[img.widths.length - 1]}.webp` : undefined);
  return {
    title: p.seo.title ?? p.title,
    description: p.seo.description ?? p.description.slice(0, 160),
    alternates: { canonical: `/products/${p.slug}` },
    openGraph: { type: 'website', title: p.title, images: ogUrl ? [{ url: ogUrl, width: img!.width, height: img!.height, alt: img!.alt }] : undefined },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const [catalogue, inventory, settings] = await Promise.all([getCatalogue(), getInventory(), getSettings()]);

  const drop = dropFor(product, catalogue.drops);
  const released = isReleased(product, catalogue.drops);
  const chart = catalogue.sizeCharts.find((c) => c.id === product.sizeChartId);
  const category = catalogue.categories.find((c) => c.id === product.categoryId);
  const related = completeTheLook(product, catalogue.products);
  const price = variantPrice(product);
  const site = 'https://nowhenceclothings.com';

  const jsonLd = [
    {
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
        availability: !released
          ? 'https://schema.org/PreOrder'
          : isSoldOut(product, inventory)
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
            <Link href="/returns" className="underline">Read the policy</Link>.
          </p>
        </div>
      ),
    },
  ];
  const items = details.filter((x): x is AccordionItem => !!x);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-muted">
        <ol className="flex flex-wrap gap-2">
          <li><Link href="/shop" className="hover:underline">Shop</Link> /</li>
          {category && <li><Link href={`/shop/${category.slug}`} className="hover:underline">{category.name}</Link> /</li>}
          <li aria-current="page">{product.title}</li>
        </ol>
      </nav>

      <ProductView
        product={product}
        stock={stockMap(product, inventory)}
        sizeChart={chart}
        upcomingReleaseAt={!released && drop ? drop.releaseAt : undefined}
        maxQty={settings.orders.maxQtyPerLine}
      />

      <div className="mt-12 grid gap-10 lg:grid-cols-[3fr_2fr] lg:gap-12">
        <div>{product.description && <Markdown source={product.description} />}</div>
        <Accordion items={items} defaultOpen={['fit']} />
      </div>

      {drop && (
        <p className="mt-8 text-sm">
          Part of <Link href={`/drops/${drop.slug}`} className="underline">{drop.name}</Link>.
        </p>
      )}

      {related.length > 0 && (
        <section className="mt-20" aria-labelledby="ctl">
          <h2 id="ctl" className="mb-8 font-display text-2xl">Complete the look</h2>
          <ProductGrid products={related} inventory={inventory} drops={catalogue.drops} />
        </section>
      )}
    </div>
  );
}
