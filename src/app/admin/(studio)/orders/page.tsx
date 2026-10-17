import Link from 'next/link';
import { requireCapability } from '@/lib/guard';
import { formatPaise } from '@/lib/money';
import { ORDER_STATUSES, OrderStatus } from '@/lib/schemas/order';
import { filterOrders, ORDER_STATUS_LABELS } from '@/lib/admin/orders';
import { getOrder, listOrderSummaries } from '@/lib/admin/store';
import { expireStaleOrders, needsStockCommit, STOCK_HOLDING_STATUSES } from '@/lib/commerce/lifecycle';

export const metadata = { title: 'Orders' };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; kind?: string }> }) {
  await requireCapability('orders.read');
  const sp = await searchParams;
  const st = OrderStatus.safeParse(sp.status);
  const status = st.success ? st.data : 'all';
  await expireStaleOrders(); // F6 lazy sweep
  const kind = sp.kind === 'preorder' || sp.kind === 'instock' ? sp.kind : 'all';
  const list = filterOrders(await listOrderSummaries(), { status, q: sp.q, kind });
  // F8: paid-or-later orders whose stock decrement never completed. Summaries
  // lack stockCommittedAt, so load recent stock-holding orders in full.
  const recent = Date.now() - 45 * 24 * 3600_000;
  const candidates = list
    .filter((o) => STOCK_HOLDING_STATUSES.includes(o.status) && Date.parse(o.createdAt) > recent)
    .slice(0, 200);
  const unstocked = new Set(
    (await Promise.all(candidates.map((o) => getOrder(o.id))))
      .filter((o): o is NonNullable<typeof o> => o != null && needsStockCommit(o))
      .map((o) => o.id),
  );
  const qs = new URLSearchParams({ ...(st.success ? { status: st.data } : {}), ...(sp.q ? { q: sp.q } : {}), ...(kind !== 'all' ? { kind } : {}) }).toString();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Orders</h1>
        <a href={`/api/admin/orders/export${qs ? `?${qs}` : ''}`} className="border border-ink px-4 py-2 text-sm">
          Export CSV
        </a>
      </div>
      <form className="flex flex-wrap items-end gap-3 text-sm" method="get">
        <label className="flex flex-col gap-1">
          Status
          <select name="status" defaultValue={status} className="border border-line px-2 py-2">
            <option value="all">All</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Type
          <select name="kind" defaultValue={kind} className="border border-line px-2 py-2">
            <option value="all">All orders</option>
            <option value="preorder">Pre-orders</option>
            <option value="instock">In-stock orders</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Search
          <input name="q" defaultValue={sp.q} placeholder="Order no, name, email" className="border border-line px-3 py-2" />
        </label>
        <button type="submit" className="bg-ink px-4 py-2 text-paper">
          Filter
        </button>
      </form>
      {unstocked.size > 0 && (
        <p role="alert" className="border border-sale p-3 text-sm text-sale">
          {unstocked.size} paid order{unstocked.size === 1 ? '' : 's'} without stock deducted. Open each flagged order and
          use Commit stock.
        </p>
      )}
      {list.length === 0 ? (
        <p className="text-sm text-muted">No orders match.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-1">Order</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {list.map((o) => (
              <tr key={o.id} className="border-t border-line">
                <td className="py-2">
                  <Link href={`/admin/orders/${o.id}`} className="font-mono underline">
                    {o.number}
                  </Link>
                </td>
                <td>{o.createdAt.slice(0, 10)}</td>
                <td>
                  {o.name}
                  <span className="block text-xs text-muted">{o.email}</span>
                </td>
                <td>{o.itemCount}</td>
                <td>{formatPaise(o.total)}</td>
                <td>
                  {ORDER_STATUS_LABELS[o.status]}
                  {o.preorder && (
                    <span className="block text-xs">Pre-order{o.shipBy ? ` · ships by ${o.shipBy}` : ''}</span>
                  )}
                  {unstocked.has(o.id) && <span className="block text-xs text-sale">Stock not deducted</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
