import { requireCapability } from '@/lib/guard';
import { getCatalogue } from '@/lib/catalogue';
import { emptyProduct, ProductEditor } from '@/components/admin/ProductEditor';
import { PageHeader } from '@/components/admin/kit';

export const metadata = { title: 'New product' };

export default async function NewProductPage() {
  await requireCapability('catalogue.write');
  const cat = await getCatalogue();
  const initial = emptyProduct({ categoryId: cat.categories[0]?.id ?? '', sizeChartId: cat.sizeCharts[0]?.id ?? '' });
  return (
    <div className="space-y-6">
      <PageHeader back={{ href: '/admin/products', label: 'Products' }} title="New product" description="Start with the title, price and one colour. You can save as a draft and come back." />
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
