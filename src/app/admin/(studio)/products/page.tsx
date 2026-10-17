import Link from 'next/link';
import { requireAdmin } from '@/lib/guard';
import { getCatalogue } from '@/lib/catalogue';
import { formatPaise } from '@/lib/money';
import { roleHas } from '@/lib/roles';
import type { MediaRef } from '@/lib/schemas/common';
import { Chip, EmptyState, PageHeader, Table, Tabs, btnPrimary, td, th, tr, type ChipTone } from '@/components/admin/kit';

export const metadata = { title: 'Products' };

const thumb = (m?: MediaRef) => (m ? (m.src ?? `/media/${m.id}/${m.widths[0] ?? m.width}.webp`) : null);
const STATUS_TONE: Record<string, ChipTone> = { active: 'success', draft: 'muted', archived: 'neutral' };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const admin = await requireAdmin();
  const { status = 'all', q = '' } = await searchParams;
  const cat = await getCatalogue();
  const needle = q.trim().toLowerCase();
  const list = cat.products
    .filter((p) => status === 'all' || p.status === status)
    .filter((p) => !needle || p.title.toLowerCase().includes(needle) || p.variants.some((v) => v.sku.toLowerCase().includes(needle)))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
  const catName = new Map(cat.categories.map((c) => [c.id, c.name]));
  const count = (s: string) => cat.products.filter((p) => s === 'all' || p.status === s).length;
  const canCreate = roleHas(admin.role, 'catalogue.write');

  return (
    <div>
      <PageHeader
        title="Products"
        description={`${cat.products.length} pieces in the catalogue.`}
        actions={
          canCreate && (
            <Link href="/admin/products/new" className={btnPrimary}>
              New product
            </Link>
          )
        }
      />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Tabs
          label="Filter by status"
          current={status}
          items={['all', 'active', 'draft', 'archived'].map((s) => ({
            key: s,
            label: s === 'all' ? 'All' : s[0].toUpperCase() + s.slice(1),
            href: s === 'all' ? '/admin/products' : `/admin/products?status=${s}`,
            count: count(s),
          }))}
        />
        <form method="get" className="mb-6" role="search">
          {status !== 'all' && <input type="hidden" name="status" value={status} />}
          <label className="sr-only" htmlFor="pq">Search products</label>
          <input id="pq" name="q" defaultValue={q} placeholder="Search title or SKU" className="h-9 w-56 border border-line bg-paper px-3 text-sm placeholder:text-muted/70 focus:border-ink focus:outline-none" />
        </form>
      </div>
      {list.length === 0 ? (
        <EmptyState
          title={needle ? 'No products match' : 'No products here yet'}
          action={canCreate && !needle ? <Link href="/admin/products/new" className={btnPrimary}>Add the first piece</Link> : undefined}
        >
          {needle ? 'Try a shorter search or another status.' : 'Products you add appear here with their colours, sizes and stock.'}
        </EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={th}>Product</th>
              <th className={th}>Category</th>
              <th className={th}>Colours</th>
              <th className={`${th} text-right`}>Price</th>
              <th className={`${th} text-right`}>Variants</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const img = thumb(p.colours[0]?.images[0]);
              return (
                <tr key={p.id} className={`${tr} group`}>
                  <td className={td}>
                    <Link href={`/admin/products/${encodeURIComponent(p.id)}`} className="flex items-center gap-3 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ink">
                      <span className="block h-12 w-10 shrink-0 overflow-hidden bg-paper-deep">
                        {img && <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium group-hover:underline">{p.title}</span>
                        <span className="block text-xs text-muted">{p.slug}</span>
                      </span>
                    </Link>
                  </td>
                  <td className={`${td} text-muted`}>{catName.get(p.categoryId) ?? p.categoryId}</td>
                  <td className={td}>
                    <span className="flex gap-1">
                      {p.colours.slice(0, 6).map((c) => (
                        <span key={c.id} title={c.name} className="h-3.5 w-3.5 rounded-full border border-ink/10" style={{ background: c.hex }} />
                      ))}
                    </span>
                  </td>
                  <td className={`${td} text-right tabular-nums`}>
                    {formatPaise(p.price)}
                    {p.compareAtPrice && p.compareAtPrice > p.price && <s className="block text-xs text-muted">{formatPaise(p.compareAtPrice)}</s>}
                  </td>
                  <td className={`${td} text-right tabular-nums text-muted`}>{p.variants.length}</td>
                  <td className={td}>
                    <Chip tone={STATUS_TONE[p.status] ?? 'neutral'}>{p.status}</Chip>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
