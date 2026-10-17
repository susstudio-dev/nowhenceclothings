'use client';
// Order status view used by the confirmation page and /orders/track (S6, S7, A15):
// a dated timeline, the pieces, totals, delivery address and GST documents.

import { useEffect, useState, type FormEvent } from 'react';
import { Button, Input, cn } from '@/components/ui';
import { ButtonLink } from '@/components/ui/ButtonLink';
import type { PublicOrder } from '@/lib/commerce/types';
import { formatPaise } from '@/lib/money';
import { LAST_ORDER_KEY } from './checkout/flow';
import { LineThumb, formatShipBy } from './cart-lines';
import { checkoutParams, isPaidStatus, trackOnce } from '@/lib/analytics/meta';

const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Awaiting payment',
  paid: 'Confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  exchange_requested: 'Exchange requested',
};
const STEPS = ['paid', 'packed', 'shipped', 'delivered'] as const;
const STEP_COPY: Record<(typeof STEPS)[number], string> = {
  paid: 'Order confirmed',
  packed: 'Packed in our studio',
  shipped: 'On its way',
  delivered: 'Delivered',
};

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

async function lookup(number: string, email: string): Promise<PublicOrder> {
  const res = await fetch('/api/orders/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ number, email }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Order not found.');
  return json.order as PublicOrder;
}

export function OrderTimeline({ order }: { order: PublicOrder }) {
  const reached = STEPS.indexOf(order.status as (typeof STEPS)[number]);
  const at = (s: string) => order.history.find((h) => h.status === s)?.at;
  const stopped = order.status === 'cancelled' || order.status === 'refunded';
  return (
    <ol className="relative space-y-0" aria-label="Order progress">
      {STEPS.map((s, i) => {
        const done = !stopped && i <= reached;
        const current = !stopped && i === reached;
        const date = at(s);
        const future = s === 'shipped' && !done && order.preorder && order.shipBy ? `Ships by ${formatShipBy(order.shipBy)}` : null;
        return (
          <li key={s} className="relative flex gap-4 pb-6 last:pb-0" aria-current={current ? 'step' : undefined}>
            {i < STEPS.length - 1 && (
              <span aria-hidden="true" className={cn('absolute left-[5px] top-4 h-[calc(100%-8px)] w-px', i < reached && !stopped ? 'bg-ink' : 'bg-line')} />
            )}
            <span
              aria-hidden="true"
              className={cn('relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border', done ? 'border-ink bg-ink' : 'border-line bg-paper', current && 'ring-4 ring-ink/10')}
            />
            <div className="min-w-0">
              <p className={cn('text-small', done ? 'text-ink' : 'text-muted')}>{STEP_COPY[s]}</p>
              <p className="text-caption text-muted">{date ? when(date) : future ?? (done ? '' : 'Pending')}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function OrderDocuments({ order }: { order: PublicOrder }) {
  if (!order.documents?.length) {
    if (order.status === 'pending_payment' || order.status === 'cancelled') return null;
    return <p className="text-caption text-muted">Your GST invoice is being prepared and will appear here shortly.</p>;
  }
  return (
    <ul className="divide-y divide-line border-y border-line">
      {order.documents.map((d) => (
        <li key={d.number}>
          <a href={d.url} target="_blank" rel="noopener" className="group flex items-center justify-between gap-4 py-3.5">
            <span>
              <span className="block text-small text-ink">{d.label}</span>
              <span className="block text-caption tabular-nums text-muted">{d.number}</span>
            </span>
            <span className="flex items-center gap-2 text-label uppercase text-ink transition-opacity duration-fast group-hover:opacity-60">
              PDF
              <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M8 2v9M4 7l4 4 4-4M3 14h10" />
              </svg>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export function OrderView({ order, hideHeading = false }: { order: PublicOrder; hideHeading?: boolean }) {
  return (
    <div className="grid gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-16">
      <div className="space-y-10">
        {!hideHeading && (
          <div className="space-y-2">
            <p className="text-label uppercase text-muted">Order {order.number}</p>
            <p className="font-display text-h3 font-light text-ink">{STATUS_LABEL[order.status] ?? order.status}</p>
          </div>
        )}
        {order.status === 'cancelled' || order.status === 'refunded' ? (
          <p className="border-l border-line pl-4 text-small text-ink-soft">
            {order.status === 'refunded' ? 'This order was refunded to the original payment method.' : 'This order was cancelled.'}
          </p>
        ) : (
          <OrderTimeline order={order} />
        )}
        {order.tracking && (
          <div className="space-y-1 border-t border-line pt-5">
            <p className="text-label uppercase text-ink">Shipment</p>
            <p className="text-small text-ink-soft">
              {order.tracking.carrier} · <span className="tabular-nums">{order.tracking.number}</span>
            </p>
            {order.tracking.url && (
              <a href={order.tracking.url} className="link-quiet text-small" target="_blank" rel="noopener noreferrer">
                Track with {order.tracking.carrier}
              </a>
            )}
          </div>
        )}
        <div className="space-y-1 border-t border-line pt-5">
          <p className="text-label uppercase text-ink">Delivering to</p>
          <p className="text-small text-ink-soft">
            {order.shippingAddress.name}, {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pincode}
          </p>
        </div>
        <div className="space-y-3 border-t border-line pt-5">
          <p className="text-label uppercase text-ink">Documents</p>
          <OrderDocuments order={order} />
        </div>
      </div>

      <div className="space-y-6">
        <p className="border-b border-ink pb-3 text-label uppercase text-ink">
          {order.lines.reduce((n, l) => n + l.qty, 0)} {order.lines.length === 1 && order.lines[0]!.qty === 1 ? 'piece' : 'pieces'}
        </p>
        <ul className="divide-y divide-line">
          {order.lines.map((l, i) => (
            <li key={i} className="flex gap-4 py-4">
              <LineThumb src={l.image} className="w-[64px]" />
              <div className="flex min-w-0 flex-1 justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-small text-ink">{l.title}</p>
                  <p className="text-caption text-muted">
                    {l.colour} · {l.size}
                    {l.qty > 1 ? ` · Qty ${l.qty}` : ''}
                  </p>
                </div>
                <p className="shrink-0 text-small tabular-nums">{formatPaise(l.unitPrice * l.qty)}</p>
              </div>
            </li>
          ))}
        </ul>
        <dl className="space-y-2.5 border-t border-line pt-5 text-small">
          <div className="flex justify-between text-ink-soft">
            <dt>Subtotal</dt>
            <dd className="tabular-nums">{formatPaise(order.subtotal)}</dd>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-ink-soft">
              <dt>{order.depositPaid ? 'Deposit paid' : `Discount${order.couponCode ? ` · ${order.couponCode}` : ''}`}</dt>
              <dd className="tabular-nums">−{formatPaise(order.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between text-ink-soft">
            <dt>Shipping</dt>
            <dd className="tabular-nums">{order.shipping ? formatPaise(order.shipping) : 'Complimentary'}</dd>
          </div>
          <div className="flex items-baseline justify-between border-t border-line pt-3">
            <dt className="text-ink">{order.depositPaid ? 'Balance paid' : 'Paid'}</dt>
            <dd className="text-lead tabular-nums text-ink">{formatPaise(order.total)}</dd>
          </div>
          <p className="text-caption text-muted">Inclusive of GST.</p>
        </dl>
      </div>
    </div>
  );
}

/** Confirmation page body: reads the last order from sessionStorage and polls until paid. */
export function OrderConfirmation() {
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(LAST_ORDER_KEY);
    } catch {
      /* blocked */
    }
    if (!raw) {
      setError('We could not find your recent order in this browser.');
      return;
    }
    const { number, email } = JSON.parse(raw) as { number: string; email: string };
    setEmail(email);
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const o = await lookup(number, email);
        setOrder(o);
        // Meta Purchase once the server has the order as paid (never for a
        // refunded oversell). sessionStorage flag per order number: reloads
        // of this page do not count twice; eventID = order number for dedup.
        if (isPaidStatus(o.status)) {
          trackOnce(o.number, 'Purchase', checkoutParams(o.lines, o.total), { eventID: o.number });
        }
        // Keep polling briefly until paid, and once more for the invoice link.
        if ((o.status === 'pending_payment' || (o.status === 'paid' && !o.documents?.length)) && ++tries < 10) timer = setTimeout(poll, 2000);
      } catch (err) {
        setError((err as Error).message);
      }
    };
    poll();
    return () => clearTimeout(timer);
  }, []);

  if (error)
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <p className="font-display text-h3 font-light">Thank you</p>
        <p className="mt-3 text-small text-muted">{error} Your confirmation email has your order number — use it to track your order.</p>
        <ButtonLink href="/orders/track" variant="secondary" className="mt-8">
          Track an order
        </ButtonLink>
      </div>
    );
  if (!order)
    return (
      <div className="space-y-4 py-10" role="status" aria-label="Loading your order">
        <div className="skeleton h-4 w-40" />
        <div className="skeleton h-10 w-72" />
        <div className="skeleton h-40 w-full" />
      </div>
    );
  const pending = order.status === 'pending_payment';
  return (
    <div className="space-y-14">
      <header className="max-w-2xl space-y-4">
        <p className="text-label uppercase text-muted">Order {order.number}</p>
        <h1 className="font-display text-display font-light text-ink">{pending ? 'Confirming your payment' : 'Thank you'}</h1>
        <p className="text-body text-ink-soft">
          {pending
            ? 'This usually takes a few seconds. You can stay on this page.'
            : order.status === 'refunded'
              ? 'Sorry — a piece sold out while you were paying. Your payment has been refunded in full.'
              : order.preorder
                ? `Your pre-order is confirmed${order.shipBy ? ` and ships by ${formatShipBy(order.shipBy)}` : ''}. A confirmation is on its way to ${email}.`
                : `Your order is confirmed. A confirmation and your GST invoice are on their way to ${email}.`}
        </p>
      </header>
      <OrderView order={order} hideHeading />
      <div className="flex flex-wrap gap-3 border-t border-line pt-8">
        <ButtonLink href="/shop" variant="secondary">
          Continue shopping
        </ButtonLink>
        <ButtonLink href={`/orders/track?number=${encodeURIComponent(order.number)}`} variant="quiet">
          Track this order
        </ButtonLink>
      </div>
    </div>
  );
}

export function OrderTrackForm({ initialNumber = '' }: { initialNumber?: string }) {
  const [number, setNumber] = useState(initialNumber);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<PublicOrder | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setOrder(await lookup(number.trim(), email.trim()));
    } catch (err) {
      setOrder(null);
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (order)
    return (
      <div className="space-y-10">
        <OrderView order={order} />
        <button type="button" onClick={() => setOrder(null)} className="link-quiet text-small text-muted">
          Look up another order
        </button>
      </div>
    );

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-5">
      <Input labelStyle="floating" label="Order number" placeholder="NWH-261017-AB12" value={number} onChange={(e) => setNumber(e.target.value.toUpperCase())} required />
      <Input labelStyle="floating" label="Email used at checkout" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      {error && (
        <p role="alert" className="border-l border-sale pl-3 text-small text-sale">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" fullWidth loading={busy}>
        Find my order
      </Button>
      <p className="text-caption text-muted">Your order number is in the confirmation email, and starts with NWH.</p>
    </form>
  );
}
