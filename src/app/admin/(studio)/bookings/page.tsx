import Link from 'next/link';
import { requireCapability } from '@/lib/guard';
import { formatPaise } from '@/lib/money';
import { BOOKING_STATUSES, BookingStatus } from '@/lib/schemas/bookings';
import { BOOKING_STATUS_LABELS, bookingTotals, filterBookings } from '@/lib/bookings';
import { listBookingSummaries, sweepBookings } from '@/lib/bookings-server';
import { Chip, EmptyState, PageHeader, Stat, StatGrid, Table, bookingTone, btnPrimary, btnSecondary, field, fieldLabel, fmtDate, td, th, tr } from '@/components/admin/kit';

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
      <PageHeader
        title="Bookings"
        description="Pre-bookings held with a deposit. Balance links go out when the sale opens."
        actions={
          <a href={`/api/admin/bookings/export${qs ? `?${qs}` : ''}`} className={btnSecondary}>
            Export CSV
          </a>
        }
      />
      <StatGrid>
        <Stat label="Bookings" value={totals.count} />
        <Stat label="Deposits collected" value={formatPaise(totals.depositsCollected)} />
        <Stat label="Balance due" value={totals.byStatus.balance_due ?? 0} tone={(totals.byStatus.balance_due ?? 0) > 0 ? 'alert' : undefined} />
        <Stat label="Completed" value={totals.byStatus.completed ?? 0} />
      </StatGrid>
      <form className="flex flex-wrap items-end gap-3 border-b border-line pb-6" method="get">
        <label className={fieldLabel}>
          Status
          <select name="status" defaultValue={status} className={field}>
            <option value="all">All</option>
            {BOOKING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {BOOKING_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldLabel}>
          Product
          <select name="product" defaultValue={sp.product ?? ''} className={field}>
            <option value="">All products</option>
            {products.map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
        </label>
        <label className={`${fieldLabel} min-w-[14rem] flex-1`}>
          Search
          <input name="q" defaultValue={sp.q} placeholder="Booking no, name, email" className={field} />
        </label>
        <button type="submit" className={btnPrimary}>
          Filter
        </button>
      </form>
      {list.length === 0 ? (
        <EmptyState title={all.length ? 'No bookings match' : 'No pre-bookings yet'}>
          {all.length
            ? 'Clear a filter to widen the search.'
            : 'Turn on pre-booking in a product’s Availability panel, then share its booking link or QR code.'}
        </EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={th}>Booking</th>
              <th className={th}>Booked</th>
              <th className={th}>Customer</th>
              <th className={th}>Piece</th>
              <th className={`${th} text-right`}>Deposit</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {list.map((b) => (
              <tr key={b.id} className={tr}>
                <td className={td}>
                  <Link
                    href={`/admin/bookings/${b.id}`}
                    className="font-mono text-xs font-medium hover:underline focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  >
                    {b.number}
                  </Link>
                </td>
                <td className={`${td} whitespace-nowrap text-muted`}>{fmtDate(b.createdAt)}</td>
                <td className={td}>
                  {b.name}
                  <span className="block text-xs text-muted">{b.email}</span>
                </td>
                <td className={td}>
                  {b.productTitle}
                  <span className="block text-xs text-muted">
                    {b.colour} / {b.size} × {b.qty}
                  </span>
                </td>
                <td className={`${td} text-right tabular-nums`}>
                  {formatPaise(b.deposit)}
                  {!b.depositPaid && <span className="block text-xs text-muted">unpaid</span>}
                </td>
                <td className={td}>
                  <span className="flex flex-wrap gap-1">
                    <Chip tone={bookingTone(b.status)}>{BOOKING_STATUS_LABELS[b.status]}</Chip>
                    {b.needsReview && <Chip tone="sale">Needs review</Chip>}
                  </span>
                  {b.balanceDueBy && b.status === 'balance_due' && <span className="mt-1 block text-xs text-muted">Due {fmtDate(b.balanceDueBy)}</span>}
                  {b.orderNumber && <span className="mt-1 block font-mono text-xs text-muted">{b.orderNumber}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
