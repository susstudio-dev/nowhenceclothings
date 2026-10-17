import Link from 'next/link';
import { requireCapability } from '@/lib/guard';
import { formatPaise } from '@/lib/money';
import { BOOKING_STATUSES, BookingStatus } from '@/lib/schemas/bookings';
import { BOOKING_STATUS_LABELS, bookingTotals, filterBookings } from '@/lib/bookings';
import { listBookingSummaries, sweepBookings } from '@/lib/bookings-server';

export const metadata = { title: 'Bookings' };
export const dynamic = 'force-dynamic';

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; product?: string }> }) {
  await requireCapability('orders.read');
  const sp = await searchParams;
  const st = BookingStatus.safeParse(sp.status);
  const status = st.success ? st.data : 'all';
  await sweepBookings(); // request-time sale-start / expiry
  const all = await listBookingSummaries();
  const list = filterBookings(all, { status, q: sp.q, productId: sp.product || undefined });
  const totals = bookingTotals(list);
  const products = [...new Map(all.map((b) => [b.productId, b.productTitle])).entries()];
  const qs = new URLSearchParams({
    ...(st.success ? { status: st.data } : {}),
    ...(sp.q ? { q: sp.q } : {}),
    ...(sp.product ? { product: sp.product } : {}),
  }).toString();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Bookings</h1>
        <a href={`/api/admin/bookings/export${qs ? `?${qs}` : ''}`} className="border border-ink px-4 py-2 text-sm">
          Export CSV
        </a>
      </div>
      <dl className="grid gap-4 sm:grid-cols-4">
        <div className="border border-line p-4">
          <dt className="text-sm text-muted">Bookings</dt>
          <dd className="text-2xl">{totals.count}</dd>
        </div>
        <div className="border border-line p-4">
          <dt className="text-sm text-muted">Deposits collected</dt>
          <dd className="text-2xl">{formatPaise(totals.depositsCollected)}</dd>
        </div>
        <div className="border border-line p-4">
          <dt className="text-sm text-muted">Balance due</dt>
          <dd className="text-2xl">{totals.byStatus.balance_due ?? 0}</dd>
        </div>
        <div className="border border-line p-4">
          <dt className="text-sm text-muted">Completed</dt>
          <dd className="text-2xl">{totals.byStatus.completed ?? 0}</dd>
        </div>
      </dl>
      <form className="flex flex-wrap items-end gap-3 text-sm" method="get">
        <label className="flex flex-col gap-1">
          Status
          <select name="status" defaultValue={status} className="border border-line px-2 py-2">
            <option value="all">All</option>
            {BOOKING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {BOOKING_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Product
          <select name="product" defaultValue={sp.product ?? ''} className="border border-line px-2 py-2">
            <option value="">All products</option>
            {products.map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Search
          <input name="q" defaultValue={sp.q} placeholder="Booking no, name, email" className="border border-line px-3 py-2" />
        </label>
        <button type="submit" className="bg-ink px-4 py-2 text-paper">
          Filter
        </button>
      </form>
      {list.length === 0 ? (
        <p className="text-sm text-muted">No bookings match.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-1">Booking</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Piece</th>
              <th>Deposit</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {list.map((b) => (
              <tr key={b.id} className="border-t border-line">
                <td className="py-2">
                  <Link href={`/admin/bookings/${b.id}`} className="font-mono underline">
                    {b.number}
                  </Link>
                </td>
                <td>{b.createdAt.slice(0, 10)}</td>
                <td>
                  {b.name}
                  <span className="block text-xs text-muted">{b.email}</span>
                </td>
                <td>
                  {b.productTitle}
                  <span className="block text-xs text-muted">
                    {b.colour} / {b.size} × {b.qty}
                  </span>
                </td>
                <td>
                  {formatPaise(b.deposit)}
                  {!b.depositPaid && <span className="block text-xs text-muted">unpaid</span>}
                </td>
                <td>
                  {BOOKING_STATUS_LABELS[b.status]}
                  {b.balanceDueBy && b.status === 'balance_due' && <span className="block text-xs">by {b.balanceDueBy.slice(0, 10)}</span>}
                  {b.orderNumber && <span className="block text-xs">{b.orderNumber}</span>}
                  {b.needsReview && <span className="block text-xs text-sale">Needs review</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
