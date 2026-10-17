import Link from 'next/link';
import { requireAdmin } from '@/lib/guard';
import { getCatalogue, getInventory } from '@/lib/catalogue';
import { roleHas } from '@/lib/roles';
import { formatPaise } from '@/lib/money';
import { stockRows } from '@/lib/admin/catalogue-mutations';
import { ORDER_STATUS_LABELS } from '@/lib/admin/orders';
import { listOrderSummaries } from '@/lib/admin/store';

export const metadata = { title: 'Overview' };

export default async function AdminHome() {
  const admin = await requireAdmin();
  const [cat, inv] = await Promise.all([getCatalogue(), getInventory()]);
  const low = stockRows(cat, inv, { lowOnly: true });
  const showOrders = roleHas(admin.role, 'orders.read');
  const orders = showOrders ? await listOrderSummaries(2) : [];
  const toPack = orders.filter((o) => o.status === 'paid');

  return (
    <div className="space-y-10">
      <h1 className="font-display text-3xl">Overview</h1>
      <dl className="grid gap-4 sm:grid-cols-3">
        <div className="border border-line p-4">
          <dt className="text-sm text-muted">Active products</dt>
          <dd className="text-2xl">{cat.products.filter((p) => p.status === 'active').length}</dd>
        </div>
        <div className="border border-line p-4">
          <dt className="text-sm text-muted">Low-stock variants</dt>
          <dd className="text-2xl">{low.length}</dd>
        </div>
        {showOrders && (
          <div className="border border-line p-4">
            <dt className="text-sm text-muted">Paid, waiting to pack</dt>
            <dd className="text-2xl">{toPack.length}</dd>
          </div>
        )}
      </dl>
      {showOrders && (
        <section>
          <h2 className="mb-3 text-lg">Recent orders</h2>
          {orders.length === 0 ? (
            <p className="text-sm text-muted">No orders yet.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {orders.slice(0, 8).map((o) => (
                <li key={o.id} className="flex justify-between py-2">
                  <Link href={`/admin/orders/${o.id}`} className="underline">
                    {o.number}
                  </Link>
                  <span>{o.name}</span>
                  <span>{ORDER_STATUS_LABELS[o.status]}</span>
                  <span>{formatPaise(o.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {low.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg">Low stock</h2>
          <ul className="text-sm">
            {low.slice(0, 10).map((r) => (
              <li key={r.sku}>
                {r.productTitle} · {r.colour} · {r.size}: <b>{r.stock}</b>
              </li>
            ))}
          </ul>
          <Link href="/admin/inventory?low=1" className="text-sm underline">
            All low-stock variants
          </Link>
        </section>
      )}
    </div>
  );
}
