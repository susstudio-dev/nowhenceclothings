import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCapability } from '@/lib/guard';
import { roleHas } from '@/lib/roles';
import { formatPaise } from '@/lib/money';
import { BOOKING_STATUS_LABELS } from '@/lib/bookings';
import { advanceBooking, quoteBalance } from '@/lib/bookings-server';
import { BookingActions } from '@/components/admin/BookingActions';

export const metadata = { title: 'Booking' };
export const dynamic = 'force-dynamic';

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireCapability('orders.read');
  const { id } = await params;
  const b = await advanceBooking(id);
  if (!b) notFound();
  const q = b.status === 'balance_due' || b.status === 'deposit_paid' ? await quoteBalance(b) : null;
  const row = (k: string, v: React.ReactNode) => (
    <>
      <dt className="text-muted">{k}</dt>
      <dd>{v}</dd>
    </>
  );

  return (
    <div className="space-y-8">
      <Link href="/admin/bookings" className="text-sm underline">
        ← Bookings
      </Link>
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-mono text-2xl">{b.number}</h1>
        <p className="text-sm">
          {BOOKING_STATUS_LABELS[b.status]} · booked {b.createdAt.slice(0, 16).replace('T', ' ')}
        </p>
      </header>
      {b.needsReview && (
        <p role="alert" className="border border-sale p-3 text-sm text-sale">
          Needs review. See the notes below.
        </p>
      )}
      <dl className="grid max-w-2xl grid-cols-2 gap-2 text-sm">
        {row('Customer', `${b.name} · ${b.email} · ${b.phone}`)}
        {row(
          'Piece',
          <Link href={`/admin/products/${b.productId}`} className="underline">
            {b.productTitle} · {b.colour} / {b.size} × {b.qty} ({b.sku})
          </Link>,
        )}
        {row('Deposit', `${formatPaise(b.deposit)} ${b.depositPaymentId ? `(paid · ${b.depositPaymentId})` : '(unpaid)'}`)}
        {row('Price at booking', formatPaise(b.lockedUnitPrice))}
        {row('Price lock', b.terms.priceLock === 'booking' ? 'At booking' : 'At sale start')}
        {row('Sale starts', b.terms.saleStartsAt.slice(0, 16).replace('T', ' '))}
        {row('Balance due by', b.balanceDueBy ? b.balanceDueBy.slice(0, 16).replace('T', ' ') : `${b.terms.balanceWindowDays} days after sale start`)}
        {row('If unpaid', b.terms.unpaidOutcome)}
        {row('Deposit refundable', b.terms.depositRefundable ? 'Yes' : 'No')}
        {q && row('Balance (now)', `${formatPaise(q.balance)} = ${formatPaise(q.subtotal)} − ${formatPaise(q.deposit)} + ${formatPaise(q.shipping)} shipping`)}
        {b.orderId && row('Order', <Link href={`/admin/orders/${b.orderId}`} className="underline">{b.orderNumber}</Link>)}
        {b.refund && row('Refund', `${formatPaise(b.refund.amount)} · ${b.refund.razorpayRefundId ?? 'manual'} · ${b.refund.reason}`)}
      </dl>
      <BookingActions
        bookingId={b.id}
        status={b.status}
        balanceDueBy={b.balanceDueBy}
        depositPaid={!!b.depositPaymentId}
        refunded={!!b.refund}
        canWrite={roleHas(admin.role, 'orders.write')}
        canRefund={roleHas(admin.role, 'orders.refund')}
      />
      <section>
        <h2 className="mb-2 text-lg">History</h2>
        <ul className="text-sm">
          {b.history.map((h, i) => (
            <li key={i}>
              {h.at.slice(0, 16).replace('T', ' ')} · {BOOKING_STATUS_LABELS[h.status]} · {h.by}
              {h.note ? ` · ${h.note}` : ''}
            </li>
          ))}
        </ul>
        {b.notes && <pre className="mt-3 whitespace-pre-wrap border border-line p-3 text-xs">{b.notes}</pre>}
        <p className="mt-2 text-xs text-muted">Emails sent: {b.emailsSent.join(', ') || 'none'}</p>
      </section>
    </div>
  );
}
