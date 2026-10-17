'use client';
// Order status view used by the confirmation page and /orders/track (S6, S7).

import { useEffect, useState, type FormEvent } from 'react';
import { Button, Input } from '@/components/ui';
import type { PublicOrder } from '@/lib/commerce/types';
import { formatPaise } from '@/lib/money';
import { LAST_ORDER_KEY } from './checkout-form';

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
const STEPS = ['paid', 'packed', 'shipped', 'delivered'];

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

export function OrderView({ order }: { order: PublicOrder }) {
  const step = STEPS.indexOf(order.status);
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted">Order {order.number}</p>
        <p className="text-2xl font-medium">{STATUS_LABEL[order.status] ?? order.status}</p>
      </div>
      {step >= 0 && (
        <ol className="grid grid-cols-4 gap-2 text-xs" aria-label="Order progress">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i === step ? 'step' : undefined}>
              <div className={`mb-2 h-1 ${i <= step ? 'bg-ink' : 'bg-line'}`} />
              {STATUS_LABEL[s]}
            </li>
          ))}
        </ol>
      )}
      {order.tracking && (
        <p className="text-sm">
          {order.tracking.carrier} · {order.tracking.number}
          {order.tracking.url && (
            <>
              {' · '}
              <a href={order.tracking.url} className="underline" target="_blank" rel="noopener noreferrer">
                Track shipment
              </a>
            </>
          )}
        </p>
      )}
      <ul className="divide-y divide-line border-y border-line">
        {order.lines.map((l, i) => (
          <li key={i} className="flex justify-between gap-4 py-3 text-sm">
            <span>
              {l.title} — {l.colour} / {l.size} × {l.qty}
            </span>
            <span className="tabular-nums">{formatPaise(l.unitPrice * l.qty)}</span>
          </li>
        ))}
      </ul>
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPaise(order.subtotal)}</dd></div>
        {order.discount > 0 && (
          <div className="flex justify-between"><dt>Discount</dt><dd>−{formatPaise(order.discount)}</dd></div>
        )}
        <div className="flex justify-between"><dt>Shipping</dt><dd>{order.shipping ? formatPaise(order.shipping) : 'Free'}</dd></div>
        <div className="flex justify-between font-medium"><dt>Total</dt><dd>{formatPaise(order.total)}</dd></div>
      </dl>
      <p className="text-sm text-muted">
        Shipping to {order.shippingAddress.name}, {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
        {order.shippingAddress.pincode}
      </p>
    </div>
  );
}

/** Confirmation page body: reads the last order from sessionStorage and polls until paid. */
export function OrderConfirmation() {
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(LAST_ORDER_KEY);
    } catch {
      /* blocked */
    }
    if (!raw) {
      setError('We could not find your recent order in this browser. Use order tracking with the number from your email.');
      return;
    }
    const { number, email } = JSON.parse(raw) as { number: string; email: string };
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const o = await lookup(number, email);
        setOrder(o);
        if (o.status === 'pending_payment' && ++tries < 10) timer = setTimeout(poll, 2000);
      } catch (err) {
        setError((err as Error).message);
      }
    };
    poll();
    return () => clearTimeout(timer);
  }, []);

  if (error) return <p className="text-sm text-muted">{error}</p>;
  if (!order) return <p className="text-sm text-muted" role="status">Loading your order…</p>;
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-medium">
        {order.status === 'pending_payment' ? 'Confirming your payment…' : 'Thank you.'}
      </h1>
      {order.status === 'refunded' && (
        <p className="text-sm">
          Sorry — an item sold out while you were paying. Your payment has been refunded in full.
        </p>
      )}
      <OrderView order={order} />
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

  return (
    <div className="space-y-10">
      <form onSubmit={onSubmit} className="space-y-4">
        <Input label="Order number" placeholder="NWH-261017-AB12" value={number} onChange={(e) => setNumber(e.target.value)} required />
        <Input label="Email used at checkout" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        {error && <p role="alert" className="text-sm text-sale">{error}</p>}
        <Button type="submit" loading={busy}>Find order</Button>
      </form>
      {order && <OrderView order={order} />}
    </div>
  );
}
