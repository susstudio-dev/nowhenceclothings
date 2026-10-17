import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BalanceForm } from '@/components/shop/booking/BalanceForm';
import { BOOKING_STATUS_LABELS } from '@/lib/bookings';
import { advanceBooking, bookingByToken, quoteBalance } from '@/lib/bookings-server';
import { formatPaise } from '@/lib/money';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your booking', robots: { index: false, follow: false }, referrer: 'no-referrer' };

const fmt = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })
    : '';

/** A13 private balance link. The token is only ever compared by its SHA-256 hash. */
export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await bookingByToken(token);
  if (!found) notFound();
  // Request-time transition: sale start / expiry apply even without cron.
  const b = (await advanceBooking(found.id)) ?? found;
  const q = b.status === 'balance_due' ? await quoteBalance(b) : null;

  return (
    <div className="container-page max-w-2xl space-y-8 py-12">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest">Booking {b.number}</p>
        <h1 className="font-display text-3xl">{BOOKING_STATUS_LABELS[b.status]}</h1>
      </header>
      <dl className="grid grid-cols-2 gap-2 border border-line p-4 text-sm">
        <dt className="text-muted">Piece</dt>
        <dd>
          {b.productTitle} · {b.colour} / {b.size} × {b.qty}
        </dd>
        <dt className="text-muted">Deposit</dt>
        <dd>
          {formatPaise(b.deposit)} {b.depositPaymentId ? '(paid)' : '(not paid yet)'}
        </dd>
        <dt className="text-muted">Sale starts</dt>
        <dd>{fmt(b.terms.saleStartsAt)}</dd>
        {b.balanceDueBy && (
          <>
            <dt className="text-muted">Pay balance by</dt>
            <dd>{fmt(b.balanceDueBy)}</dd>
          </>
        )}
      </dl>

      {b.status === 'deposit_pending' && (
        <p className="text-sm">We are waiting for your deposit payment to confirm. If you paid, refresh in a minute.</p>
      )}
      {b.status === 'deposit_paid' && (
        <p className="text-sm">
          You are booked. When the sale starts we will email you; come back to this link to pay the balance. Keep this link private.
        </p>
      )}
      {b.status === 'balance_due' && q && (
        <section className="space-y-6">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt>Price</dt>
            <dd className="text-right">{formatPaise(q.subtotal)}</dd>
            <dt>Deposit paid</dt>
            <dd className="text-right">−{formatPaise(q.deposit)}</dd>
            <dt>Shipping</dt>
            <dd className="text-right">{q.shipping ? formatPaise(q.shipping) : 'Free'}</dd>
            <dt className="font-medium">Balance to pay</dt>
            <dd className="text-right font-medium">{formatPaise(q.balance)}</dd>
          </dl>
          <BalanceForm token={token} name={b.name} phone={b.phone} balance={q.balance} />
        </section>
      )}
      {b.status === 'completed' && (
        <p className="text-sm">
          Paid in full. Your order is <strong>{b.orderNumber}</strong>.{' '}
          {b.orderNumber && (
            <Link href={`/orders/track?number=${encodeURIComponent(b.orderNumber)}`} className="underline">
              Track it
            </Link>
          )}
        </p>
      )}
      {b.status === 'expired' && <p className="text-sm">The balance window has closed. Contact us if you still want the piece.</p>}
      {b.status === 'cancelled' && <p className="text-sm">This booking was cancelled.</p>}
      {b.status === 'refunded' && (
        <p className="text-sm">Your deposit of {formatPaise(b.refund?.amount ?? b.deposit)} has been refunded.</p>
      )}
      {b.terms.policy && <p className="text-xs text-muted">{b.terms.policy}</p>}
    </div>
  );
}
