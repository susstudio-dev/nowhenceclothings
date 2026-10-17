import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { BalanceForm } from '@/components/shop/booking/BalanceForm';
import { BOOKING_STATUS_LABELS } from '@/lib/bookings';
import { advanceBooking, bookingByToken, quoteBalance } from '@/lib/bookings-server';
import { bookingDocumentLinks } from '@/lib/invoices/links';
import { formatPaise } from '@/lib/money';
import type { BookingStatus } from '@/lib/schemas/bookings';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your booking', robots: { index: false, follow: false }, referrer: 'no-referrer' };

const fmt = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '';
const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }) : '');

const LEAD: Partial<Record<BookingStatus, string>> = {
  deposit_pending: 'We are waiting for your deposit to confirm. If you have paid, this page updates in a minute.',
  deposit_paid: 'You are booked. When the sale opens we email you; come back to this private link to pay the balance.',
  balance_due: 'The sale is open. Confirm your delivery address and pay the balance to complete your order.',
  expired: 'The balance window has closed. Write to us if you still want the piece.',
  cancelled: 'This booking was cancelled.',
};

/** A13 private balance link. The token is only ever compared by its SHA-256 hash. */
export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await bookingByToken(token);
  if (!found) notFound();
  // Request-time transition: sale start / expiry apply even without cron.
  const b = (await advanceBooking(found.id)) ?? found;
  const [q, docs] = await Promise.all([b.status === 'balance_due' ? quoteBalance(b) : null, bookingDocumentLinks(b).catch(() => [])]);
  const steps: { label: string; at?: string; done: boolean }[] = [
    { label: 'Deposit paid', at: b.history.find((h) => h.status === 'deposit_paid')?.at, done: !!b.depositPaymentId },
    { label: 'Sale opens', at: b.terms.saleStartsAt, done: ['balance_due', 'completed'].includes(b.status) },
    { label: 'Balance paid', at: b.history.find((h) => h.status === 'completed')?.at, done: b.status === 'completed' },
  ];

  return (
    <div className="container-page grid gap-12 pb-section pt-10 md:pt-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-20">
      <div className="space-y-10">
        <header className="space-y-4">
          <p className="text-label uppercase text-muted">Booking {b.number}</p>
          <h1 className="font-display text-display-sm font-light text-ink">{BOOKING_STATUS_LABELS[b.status]}</h1>
          {LEAD[b.status] && <p className="text-body text-ink-soft">{LEAD[b.status]}</p>}
          {b.status === 'completed' && (
            <p className="text-body text-ink-soft">
              Paid in full. Your order is <span className="tabular-nums text-ink">{b.orderNumber}</span>.
            </p>
          )}
          {b.status === 'refunded' && <p className="text-body text-ink-soft">Your deposit of {formatPaise(b.refund?.amount ?? b.deposit)} has been refunded.</p>}
        </header>

        {!['cancelled', 'refunded', 'expired'].includes(b.status) && (
          <ol className="grid grid-cols-3 gap-4 border-y border-line py-5" aria-label="Booking progress">
            {steps.map((s) => (
              <li key={s.label} className="space-y-2">
                <span aria-hidden="true" className={`block h-px ${s.done ? 'bg-ink' : 'bg-line'}`} />
                <span className={`block text-small ${s.done ? 'text-ink' : 'text-muted'}`}>{s.label}</span>
                <span className="block text-caption text-muted">{day(s.at)}</span>
              </li>
            ))}
          </ol>
        )}

        <dl className="divide-y divide-line border-b border-line text-small">
          {[
            ['Piece', `${b.productTitle} · ${b.colour} · ${b.size}${b.qty > 1 ? ` · Qty ${b.qty}` : ''}`],
            ['Deposit', `${formatPaise(b.deposit)} ${b.depositPaymentId ? '· paid' : '· not paid yet'}`],
            ['Sale opens', fmt(b.terms.saleStartsAt)],
            ...(b.balanceDueBy ? [['Pay balance by', fmt(b.balanceDueBy)]] : []),
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-6 py-3">
              <dt className="text-muted">{k}</dt>
              <dd className="text-right text-ink">{v}</dd>
            </div>
          ))}
        </dl>

        {docs.length > 0 && (
          <div className="space-y-3">
            <p className="text-label uppercase text-ink">Documents</p>
            <ul className="divide-y divide-line border-y border-line">
              {docs.map((d) => (
                <li key={d.number}>
                  <a href={d.url} target="_blank" rel="noopener" className="flex items-center justify-between py-3 hover:opacity-70">
                    <span>
                      <span className="block text-small text-ink">{d.label}</span>
                      <span className="block text-caption tabular-nums text-muted">{d.number}</span>
                    </span>
                    <span className="text-label uppercase">PDF ↓</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {b.status !== 'balance_due' && b.terms.policy && <p className="text-caption text-muted">{b.terms.policy}</p>}
        <p className="text-caption text-muted">Keep this link private — it is the key to your booking.</p>
      </div>

      <div>
        {b.status === 'balance_due' && q ? (
          <section className="space-y-8" aria-label="Pay the balance">
            <dl className="space-y-2.5 text-small">
              <div className="flex justify-between text-ink-soft">
                <dt>Price</dt>
                <dd className="tabular-nums">{formatPaise(q.subtotal)}</dd>
              </div>
              <div className="flex justify-between text-ink-soft">
                <dt>Deposit paid</dt>
                <dd className="tabular-nums">−{formatPaise(q.deposit)}</dd>
              </div>
              <div className="flex justify-between text-ink-soft">
                <dt>Shipping</dt>
                <dd className="tabular-nums">{q.shipping ? formatPaise(q.shipping) : 'Complimentary'}</dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-line pt-3">
                <dt className="text-ink">Balance to pay</dt>
                <dd className="text-lead tabular-nums text-ink">{formatPaise(q.balance)}</dd>
              </div>
              <p className="text-caption text-muted">Inclusive of GST. Your tax invoice follows payment.</p>
            </dl>
            <BalanceForm
              token={token}
              name={b.name}
              phone={b.phone}
              email={b.email}
              balance={q.balance}
              address={b.address ? { name: b.address.name, line1: b.address.line1, line2: b.address.line2, city: b.address.city, state: b.address.state, pincode: b.address.pincode } : undefined}
            />
          </section>
        ) : b.status === 'completed' && b.orderNumber ? (
          <div className="space-y-4 border-l border-line pl-6">
            <p className="text-small text-ink-soft">Follow your order and download its GST invoice.</p>
            <ButtonLink href={`/orders/track?number=${encodeURIComponent(b.orderNumber)}`} variant="secondary">
              Track order {b.orderNumber}
            </ButtonLink>
          </div>
        ) : (
          <div className="hidden lg:block" />
        )}
      </div>
    </div>
  );
}
