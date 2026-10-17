import { notFound } from 'next/navigation';
import { requireCapability } from '@/lib/guard';
import { getCatalogue } from '@/lib/catalogue';
import { ProductEditor } from '@/components/admin/ProductEditor';

export const metadata = { title: 'Edit product' };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCapability('catalogue.write');
  const { id } = await params;
  const cat = await getCatalogue();
  const product = cat.products.find((p) => p.id === decodeURIComponent(id));
  if (!product) notFound();
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">{product.title}</h1>
      <p className="text-sm text-muted">
        <a className="underline" href={`/products/${product.slug}`} target="_blank" rel="noreferrer">
          View on site
        </a>
      </p>
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
