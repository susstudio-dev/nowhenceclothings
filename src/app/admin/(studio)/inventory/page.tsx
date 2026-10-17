import { requireCapability } from '@/lib/guard';
import { getCatalogue, getInventory } from '@/lib/catalogue';
import { stockRows } from '@/lib/admin/catalogue-mutations';
import { InventoryTable } from '@/components/admin/InventoryTable';
import { PageHeader, EmptyState, Tabs } from '@/components/admin/kit';

export const metadata = { title: 'Inventory' };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ low?: string }> }) {
  await requireCapability('inventory.write');
  const { low } = await searchParams;
  const [cat, inv] = await Promise.all([getCatalogue(), getInventory()]);
  const rows = stockRows(cat, inv, { lowOnly: low === '1' });
  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" description="Stock per colour and size. Variants at or below their threshold count as low." />
      <Tabs
        label="Filter"
        current={low === '1' ? 'low' : 'all'}
        items={[
          { key: 'all', label: 'All variants', href: '/admin/inventory' },
          { key: 'low', label: 'Low stock', href: '/admin/inventory?low=1' },
        ]}
      />
      {rows.length === 0 ? <EmptyState title={low === '1' ? 'Nothing is running low' : 'No variants yet'}>{low === '1' ? 'Every variant is above its low-stock threshold.' : 'Add colours and sizes to a product to track stock here.'}</EmptyState> : <InventoryTable rows={rows} canEdit />}
    </div>
  );
}
