import { requireCapability } from '@/lib/guard';
import { readJson } from '@/lib/storage';
import { getCatalogue } from '@/lib/catalogue';
import { COUPONS_KEY, CouponsDoc } from '@/lib/schemas/coupons';
import { CouponsEditor, SalePricing } from '@/components/admin/CouponsEditor';
import { PageHeader } from '@/components/admin/kit';

export const metadata = { title: 'Coupons & sales' };

export default async function CouponsPage() {
  await requireCapability('coupons.write');
  const [doc, cat] = await Promise.all([readJson(COUPONS_KEY, CouponsDoc), getCatalogue()]);
  const products = cat.products
    .filter((p) => p.status !== 'archived')
    .map(({ id, title, price, compareAtPrice }) => ({ id, title, price, compareAtPrice }));
  return (
    <div className="space-y-12">
      <section>
        <PageHeader title="Coupons & sales" description="Codes customers enter at checkout, and site-wide sale pricing." />
        <h2 className="mb-4 text-[11px] font-medium uppercase tracking-label">Coupons</h2>
        <CouponsEditor coupons={doc?.coupons ?? []} />
      </section>
      <section className="space-y-4 border-t border-line pt-10">
        <h2 className="text-[11px] font-medium uppercase tracking-label">Sale pricing</h2>
        <p className="text-sm text-muted">
          Puts selected products on sale from their regular price. Per-product prices can also be edited on each product.
        </p>
        <SalePricing products={products} />
      </section>
    </div>
  );
}
