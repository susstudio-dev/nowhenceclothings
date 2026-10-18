import { requireCapability } from '@/lib/guard';
import { getCatalogue } from '@/lib/catalogue';
import { SizeChartsEditor } from '@/components/admin/SizeChartsEditor';
import { PageHeader } from '@/components/admin/kit';

export const metadata = { title: 'Size charts' };

export default async function SizeChartsPage() {
  await requireCapability('catalogue.write');
  const cat = await getCatalogue();
  const usage: Record<string, string[]> = {};
  for (const p of cat.products) (usage[p.sizeChartId] ??= []).push(p.title);
  return (
    <div>
      <PageHeader
        title="Size charts"
        description="The measurements behind each product's size guide and the public size guide page. Products pick their chart on the product screen."
      />
      <SizeChartsEditor charts={cat.sizeCharts} usage={usage} />
    </div>
  );
}
