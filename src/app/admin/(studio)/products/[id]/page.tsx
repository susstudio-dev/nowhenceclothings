import { notFound } from 'next/navigation';
import { requireCapability } from '@/lib/guard';
import { getCatalogue } from '@/lib/catalogue';
import { ProductEditor } from '@/components/admin/ProductEditor';
import { PageHeader, Chip, btnSecondary } from '@/components/admin/kit';

export const metadata = { title: 'Edit product' };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCapability('catalogue.write');
  const { id } = await params;
  const cat = await getCatalogue();
  const product = cat.products.find((p) => p.id === decodeURIComponent(id));
  if (!product) notFound();
  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: '/admin/products', label: 'Products' }}
        title={product.title}
        description={<span className="flex items-center gap-2 pt-1"><Chip tone={product.status === 'active' ? 'success' : 'muted'}>{product.status}</Chip><span className="font-mono text-xs">/{product.slug}</span></span>}
        actions={<a className={btnSecondary} href={`/products/${product.slug}`} target="_blank" rel="noreferrer">View on site ↗</a>}
      />
      <ProductEditor
        key={product.updatedAt}
        mode="update"
        initial={product}
        categories={cat.categories}
        collections={cat.collections}
        drops={cat.drops}
        sizeCharts={cat.sizeCharts}
      />
    </div>
  );
}
