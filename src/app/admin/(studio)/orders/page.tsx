import Link from 'next/link';
import { requireCapability } from '@/lib/guard';
import { formatPaise } from '@/lib/money';
import { ORDER_STATUSES, OrderStatus } from '@/lib/schemas/order';
import { filterOrders, ORDER_STATUS_LABELS } from '@/lib/admin/orders';
import { getOrder, listOrderSummaries } from '@/lib/admin/store';
import { Callout, Chip, EmptyState, PageHeader, Table, btnPrimary, btnSecondary, field, fieldLabel, fmtDateTime, orderTone, td, th, tr } from '@/components/admin/kit';
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
    <div>
      <PageHeader
        title="Orders"
        description={`${list.length} order${list.length === 1 ? '' : 's'}${status !== 'all' ? ` · ${ORDER_STATUS_LABELS[status]}` : ''}`}
        actions={
          <>
            <a href="/api/admin/invoices/ledger" className={btnSecondary}>
              GST ledger (CSV)
            </a>
            <a href={`/api/admin/orders/export${qs ? `?${qs}` : ''}`} className={btnSecondary}>
              Export CSV
            </a>
          </>
        }
      />
      <form className="mb-6 flex flex-wrap items-end gap-3 border-b border-line pb-6" method="get">
        <label className={fieldLabel}>
          Status
          <select name="status" defaultValue={status} className={field}>
            <option value="all">All</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldLabel}>
          Type
          <select name="kind" defaultValue={kind} className={field}>
            <option value="all">All orders</option>
            <option value="preorder">Pre-orders</option>
            <option value="instock">In-stock orders</option>
          </select>
        </label>
        <label className={`${fieldLabel} min-w-[14rem] flex-1`}>
          Search
          <input name="q" defaultValue={sp.q} placeholder="Order no, name, email" className={field} />
        </label>
        <button type="submit" className={btnPrimary}>
          Filter
        </button>
      </form>
      {unstocked.size > 0 && (
        <div className="mb-6">
          <Callout tone="alert" title={`${unstocked.size} paid order${unstocked.size === 1 ? '' : 's'} without stock deducted`}>
            Open each flagged order and use Commit stock.
          </Callout>
        </div>
      )}
      {list.length === 0 ? (
        <EmptyState title={sp.q || status !== 'all' || kind !== 'all' ? 'No orders match these filters' : 'No orders yet'}>
          {sp.q || status !== 'all' || kind !== 'all' ? 'Clear a filter to widen the search.' : 'Paid orders will land here as soon as checkout completes.'}
        </EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={th}>Order</th>
              <th className={th}>Placed</th>
              <th className={th}>Customer</th>
              <th className={`${th} text-right`}>Items</th>
              <th className={`${th} text-right`}>Total</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {list.map((o) => (
              <tr key={o.id} className={tr}>
                <td className={td}>
                  <Link href={`/admin/orders/${o.id}`} className="font-mono text-xs font-medium hover:underline focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ink">
                    {o.number}
                  </Link>
                </td>
                <td className={`${td} whitespace-nowrap text-muted`}>{fmtDateTime(o.createdAt)}</td>
                <td className={td}>
                  {o.name}
                  <span className="block text-xs text-muted">{o.email}</span>
                </td>
                <td className={`${td} text-right tabular-nums`}>{o.itemCount}</td>
                <td className={`${td} text-right tabular-nums`}>{formatPaise(o.total)}</td>
                <td className={td}>
                  <span className="flex flex-wrap gap-1">
                    <Chip tone={orderTone(o.status)}>{ORDER_STATUS_LABELS[o.status]}</Chip>
                    {o.preorder && <Chip tone="neutral">Pre-order</Chip>}
                    {unstocked.has(o.id) && <Chip tone="sale">Stock not deducted</Chip>}
                  </span>
                  {o.preorder && o.shipBy && <span className="mt-1 block text-xs text-muted">Ships by {o.shipBy}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
