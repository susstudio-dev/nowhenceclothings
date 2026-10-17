import type { Metadata } from 'next';
import { ListingPage } from '@/components/shop/ListingPage';
import { getActiveProducts, getCatalogue, getInventory } from '@/lib/catalogue';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Shop all', alternates: { canonical: '/shop' } };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ShopPage({ searchParams }: { searchParams: SP }) {
  const [params, products, catalogue, inventory] = await Promise.all([searchParams, getActiveProducts(), getCatalogue(), getInventory()]);
  return (
    <ListingPage
      title="Shop all"
      basePath="/shop"
      params={params}
      products={products}
      inventory={inventory}
      drops={catalogue.drops}
    />
  );
}
