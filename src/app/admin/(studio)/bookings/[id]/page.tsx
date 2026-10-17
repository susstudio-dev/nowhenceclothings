import Link from 'next/link';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { requireCapability } from '@/lib/guard';
import { roleHas } from '@/lib/roles';
import { formatPaise } from '@/lib/money';
import { BOOKING_STATUS_LABELS } from '@/lib/bookings';
import { advanceBooking, quoteBalance } from '@/lib/bookings-server';
import { BookingActions } from '@/components/admin/BookingActions';
import { Callout, Chip, DefList, PageHeader, Panel, bookingTone, fmtDateTime } from '@/components/admin/kit';

export const metadata = { title: 'Booking' };
export const dynamic = 'force-dynamic';

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireCapability('orders.read');
  const { id } = await params;
  const b = await advanceBooking(id);
  if (!b) notFound();
  const q = b.status === 'balance_due' || b.status === 'deposit_paid' ? await quoteBalance(b) : null;
  const d = fmtDateTime;
  const rows: [ReactNode, ReactNode][] = [
    [
      'Customer',
      <span key="c">
        {b.name}
        <br />
        <span className="text-muted">
          {b.email} · {b.phone}
        </span>
      </span>,
    ],
    [
      'Piece',
      <Link key="p" href={`/admin/products/${b.productId}`} className="hover:underline">
        {b.productTitle} · {b.colour} / {b.size} × {b.qty} <span className="font-mono text-xs text-muted">{b.sku}</span>
      </Link>,
    ],
    ['Deposit', `${formatPaise(b.deposit)} ${b.depositPaymentId ? `(paid · ${b.depositPaymentId})` : '(unpaid)'}`],
    ['Price at booking', formatPaise(b.lockedUnitPrice)],
    ['Price lock', b.terms.priceLock === 'booking' ? 'At booking' : 'At sale start'],
    ['Sale starts', d(b.terms.saleStartsAt)],
    ['Balance due by', b.balanceDueBy ? d(b.balanceDueBy) : `${b.terms.balanceWindowDays} days after sale start`],
    ['If unpaid', b.terms.unpaidOutcome],
    ['Deposit refundable', b.terms.depositRefundable ? 'Yes' : 'No'],
  ];
  if (q) rows.push(['Balance (now)', `${formatPaise(q.balance)} = ${formatPaise(q.subtotal)} − ${formatPaise(q.deposit)} + ${formatPaise(q.shipping)} shipping`]);
  if (b.orderId)
    rows.push([
      'Order',
      <Link key="o" href={`/admin/orders/${b.orderId}`} className="font-mono text-xs hover:underline">
        {b.orderNumber}
      </Link>,
    ]);
  if (b.refund) rows.push(['Refund', `${formatPaise(b.refund.amount)} · ${b.refund.razorpayRefundId ?? 'manual'} · ${b.refund.reason}`]);

  return (
    <div>
      <PageHeader
        back={{ href: '/admin/bookings', label: 'Bookings' }}
        eyebrow={`Booked ${d(b.createdAt)}`}
        title={<span className="font-mono text-[26px] tracking-normal">{b.number}</span>}
        description={
          <span className="flex flex-wrap gap-2 pt-1">
            <Chip tone={bookingTone(b.status)}>{BOOKING_STATUS_LABELS[b.status]}</Chip>
            {b.needsReview && <Chip tone="sale">Needs review</Chip>}
          </span>
        }
      />
      {b.needsReview && (
        <div className="mb-6">
          <Callout tone="alert" title="Needs review">
            See the notes under History.
          </Callout>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Panel title="Booking">
            <DefList rows={rows} />
          </Panel>
          <Panel title="History">
            <ol className="relative space-y-4 border-l border-line pl-5 text-sm">
              {[...b.history].reverse().map((h, i) => (
                <li key={i} className="relative">
                  <span
                    aria-hidden
                    className={`absolute -left-[24.5px] top-1.5 h-2 w-2 rounded-full border ${i === 0 ? 'border-ink bg-ink' : 'border-line bg-paper'}`}
                  />
                  <p>
                    <span className="font-medium">{BOOKING_STATUS_LABELS[h.status]}</span>
                    <span className="ml-2 text-xs text-muted">
                      {d(h.at)} · {h.by}
                    </span>
                  </p>
                  {h.note && <p className="mt-0.5 text-muted">{h.note}</p>}
                </li>
              ))}
            </ol>
            {b.notes && <pre className="mt-4 whitespace-pre-wrap border border-line bg-paper-deep/40 p-3 font-sans text-xs">{b.notes}</pre>}
            <p className="mt-3 text-xs text-muted">Emails sent: {b.emailsSent.join(', ') || 'none'}</p>
          </Panel>
        </div>
        <aside>
          <Panel title="Actions">
            <BookingActions
              bookingId={b.id}
              status={b.status}
              balanceDueBy={b.balanceDueBy}
              depositPaid={!!b.depositPaymentId}
              refunded={!!b.refund}
              canWrite={roleHas(admin.role, 'orders.write')}
              canRefund={roleHas(admin.role, 'orders.refund')}
            />
          </Panel>
        </aside>
      </div>
    </div>
  );
}
