import Link from 'next/link';
import { requireCapability } from '@/lib/guard';
import { getCatalogue, getInventory } from '@/lib/catalogue';
import { stockRows } from '@/lib/admin/catalogue-mutations';
import { InventoryTable } from '@/components/admin/InventoryTable';

export const metadata = { title: 'Inventory' };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ low?: string }> }) {
  await requireCapability('inventory.write');
  const { low } = await searchParams;
  const [cat, inv] = await Promise.all([getCatalogue(), getInventory()]);
  const rows = stockRows(cat, inv, { lowOnly: low === '1' });
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Inventory</h1>
      <nav className="flex gap-4 text-sm" aria-label="Filter">
        <Link href="/admin/inventory" className={low === '1' ? 'text-muted' : 'underline'}>
          All variants
        </Link>
        <Link href="/admin/inventory?low=1" className={low === '1' ? 'underline' : 'text-muted'}>
          Low stock
        </Link>
      </nav>
      {rows.length === 0 ? <p className="text-sm text-muted">Nothing here.</p> : <InventoryTable rows={rows} canEdit />}
    </div>
  );
}
