import { requireCapability } from '@/lib/guard';
import { readJson } from '@/lib/storage';
import { getCatalogue } from '@/lib/catalogue';
import { COUPONS_KEY, CouponsDoc } from '@/lib/schemas/coupons';
import { CouponsEditor, SalePricing } from '@/components/admin/CouponsEditor';

export const metadata = { title: 'Coupons & sales' };

export default async function CouponsPage() {
  await requireCapability('coupons.write');
  const [doc, cat] = await Promise.all([readJson(COUPONS_KEY, CouponsDoc), getCatalogue()]);
  const products = cat.products
    .filter((p) => p.status !== 'archived')
    .map(({ id, title, price, compareAtPrice }) => ({ id, title, price, compareAtPrice }));
  return (
    <div className="space-y-12">
      <section className="space-y-4">
        <h1 className="font-display text-3xl">Coupons</h1>
        <CouponsEditor coupons={doc?.coupons ?? []} />
      </section>
      <section className="space-y-4">
        <h2 className="font-display text-2xl">Sale pricing</h2>
        <p className="text-sm text-muted">
          Puts selected products on sale from their regular price. Per-product prices can also be edited on each product.
        </p>
        <SalePricing products={products} />
      </section>
    </div>
  );
}
