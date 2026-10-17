import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Accordion, type AccordionItem } from '@/components/ui';
import { Markdown } from '@/components/shop/Markdown';
import { ProductGrid } from '@/components/shop/ProductCard';
import { ProductView } from '@/components/shop/ProductView';
import { completeTheLook, dropFor, stockMap } from '@/components/shop/merch';
import { getInventory, isReleased } from '@/lib/catalogue';
import { isIndexable } from '@/lib/launches';
import { getStorefrontCatalogue } from '@/lib/launches-server';
import { getSettings } from '@/lib/content';
import { productBreadcrumb, productLd, jsonLdScript } from '@/lib/jsonld';
import { formatPaise } from '@/lib/money';
import { buildMetadata, paths, plainText } from '@/lib/seo';
import { returnsLabel } from '@/lib/static-pages';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  // A10: projected product only: hidden titles/images never reach metadata.
  const p = (await getStorefrontCatalogue()).products.find((x) => x.slug === slug);
  if (!p) return {};
  const preorder = p.launch.state === 'presale';
  return buildMetadata({
    // Admin SEO title wins; presale pieces say so, e.g. "Ring Embroidered Polo — Pre-order | Nowhence".
    title: preorder ? `${p.title} — Pre-order` : p.title,
    path: paths.product(p.slug),
    seo: p.seo,
    description: plainText(p.description),
    descriptionSupport: `${p.title}${preorder ? ', available to pre-order' : ''} from Nowhence. Heavyweight unisex clothing, designed in India.`,
    image: p.colours[0]?.images[0],
    noindex: !isIndexable(p),
    follow: true,
  });
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

  // A10: no Product / breadcrumb JSON-LD while coming soon.
  const jsonLd = isIndexable(product)
    ? [productLd(product, { stock: stockMap(product, inventory), drop, settings, category }), productBreadcrumb(product, category)]
    : [];

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
    <div className="container-page pt-4 md:pt-8">
      {jsonLd.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />}
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
