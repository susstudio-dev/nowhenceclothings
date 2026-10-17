import Link from 'next/link';
import { requireAdmin } from '@/lib/guard';
import { getCatalogue } from '@/lib/catalogue';
import { formatPaise } from '@/lib/money';

export const metadata = { title: 'Products' };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const { status = 'all' } = await searchParams;
  const cat = await getCatalogue();
  const list = cat.products
    .filter((p) => status === 'all' || p.status === status)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
  const catName = new Map(cat.categories.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Products</h1>
        <Link href="/admin/products/new" className="bg-ink px-4 py-2 text-sm text-paper">
          New product
        </Link>
      </div>
      <nav className="flex gap-4 text-sm" aria-label="Filter by status">
        {['all', 'active', 'draft', 'archived'].map((s) => (
          <Link key={s} href={s === 'all' ? '/admin/products' : `/admin/products?status=${s}`} aria-current={s === status ? 'page' : undefined} className={s === status ? 'underline' : 'text-muted'}>
            {s}
          </Link>
        ))}
      </nav>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted">
            <th className="py-1">Title</th>
            <th>Category</th>
            <th>Price</th>
            <th>Variants</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {list.map((p) => (
            <tr key={p.id} className="border-t border-line">
              <td className="py-2">
                <Link href={`/admin/products/${encodeURIComponent(p.id)}`} className="underline">
                  {p.title}
                </Link>
              </td>
              <td>{catName.get(p.categoryId) ?? p.categoryId}</td>
              <td>
                {formatPaise(p.price)}
                {p.compareAtPrice && p.compareAtPrice > p.price && <s className="ml-2 text-muted">{formatPaise(p.compareAtPrice)}</s>}
              </td>
              <td>{p.variants.length}</td>
              <td>{p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
