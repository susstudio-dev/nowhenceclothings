import type { Metadata } from 'next';
import { ListingPage } from '@/components/shop/ListingPage';
import { getCatalogue, getInventory } from '@/lib/catalogue';
import { getStorefrontProducts, publicDrops } from '@/lib/launches-server';
import { breadcrumbLd, jsonLdScript } from '@/lib/jsonld';
import { buildMetadata, paths } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({
  title: 'Shop all',
  path: paths.shop(),
  description: 'Every Nowhence piece in one place. Heavyweight unisex cotton, quiet colour, sizes XS to XXL, designed in India.',
});

const crumbs = jsonLdScript(breadcrumbLd([{ name: 'Home', path: paths.home() }, { name: 'Shop', path: paths.shop() }]));

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ShopPage({ searchParams }: { searchParams: SP }) {
  const [params, products, catalogue, inventory] = await Promise.all([searchParams, getStorefrontProducts('shop'), getCatalogue(), getInventory()]);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: crumbs }} />
      <ListingPage
        title="Shop all"
        basePath="/shop"
        params={params}
        products={products}
        inventory={inventory}
        drops={publicDrops(catalogue.drops)}
      />
    </>
  );
}
