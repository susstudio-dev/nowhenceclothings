import { requireCapability } from '@/lib/guard';
import { getCatalogue } from '@/lib/catalogue';
import { emptyProduct, ProductEditor } from '@/components/admin/ProductEditor';

export const metadata = { title: 'New product' };

export default async function NewProductPage() {
  await requireCapability('catalogue.write');
  const cat = await getCatalogue();
  const initial = emptyProduct({ categoryId: cat.categories[0]?.id ?? '', sizeChartId: cat.sizeCharts[0]?.id ?? '' });
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">New product</h1>
      <ProductEditor
        mode="create"
        initial={initial}
        categories={cat.categories}
        collections={cat.collections}
        drops={cat.drops}
        sizeCharts={cat.sizeCharts}
      />
    </div>
  );
}
