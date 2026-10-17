'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Button, Input, Price, cn } from '@/components/ui';
import { applyCoupon, MAX_QTY, removeLine, updateQty, type CartLine } from '@/lib/commerce/cart-client';
import { ISSUE_TEXT } from '@/lib/commerce/use-quote';
import type { QuoteResponse } from '@/lib/commerce/types';
import { formatPaise } from '@/lib/money';

export function CartLines({
  lines,
  quote,
  compact = false,
}: {
  lines: CartLine[];
  quote: QuoteResponse | null;
  compact?: boolean;
}) {
  return (
    <ul className="divide-y divide-line">
      {lines.map((line) => {
        const q = quote?.lines.find((l) => l.sku === line.sku);
        const issue = quote?.issues.find((i) => i.sku === line.sku);
        const unit = q?.unitPrice ?? line.unitPrice ?? 0;
        const title = q?.title ?? line.title ?? line.sku;
        const slug = q?.slug ?? line.slug;
        const image = q?.image ?? line.image;
        const href = slug ? `/products/${slug}` : '#';
        const maxQty = Math.min(MAX_QTY, q?.available ?? MAX_QTY);
        return (
          <li key={line.sku} className="flex gap-4 py-4">
            <Link href={href} className="shrink-0">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image}
                  alt=""
                  width={compact ? 72 : 96}
                  height={compact ? 96 : 128}
                  className="aspect-[3/4] w-[72px] bg-line object-cover sm:w-24"
                />
              ) : (
                <div className="aspect-[3/4] w-[72px] bg-line sm:w-24" aria-hidden="true" />
              )}
            </Link>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex justify-between gap-2">
                <Link href={href} className="truncate text-sm font-medium">
                  {title}
                </Link>
                <Price amount={unit * line.qty} compareAt={q?.compareAtPrice ? q.compareAtPrice * line.qty : undefined} size="sm" />
              </div>
              <p className="text-sm text-muted">
                {line.colour} · {line.size}
              </p>
              {issue && (
                <p className="text-sm text-sale" role="status">
                  {ISSUE_TEXT[issue.issue]}
                </p>
              )}
              <div className="mt-auto flex items-center justify-between pt-2">
                <div className="flex items-center border border-line" role="group" aria-label={`Quantity for ${title}`}>
                  <button
                    type="button"
                    className="h-8 w-8 text-lg disabled:opacity-40"
                    onClick={() => updateQty(line.sku, line.qty - 1)}
                    aria-label="Decrease quantity"
                    disabled={line.qty <= 1}
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm tabular-nums" aria-live="polite">
                    {line.qty}
                  </span>
                  <button
                    type="button"
                    className="h-8 w-8 text-lg disabled:opacity-40"
                    onClick={() => updateQty(line.sku, line.qty + 1)}
                    aria-label="Increase quantity"
                    disabled={line.qty >= maxQty}
                  >
                    +
                  </button>
                </div>
                <button type="button" className="text-sm text-muted underline" onClick={() => removeLine(line.sku)}>
                  Remove
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function FreeShippingProgress({ quote }: { quote: QuoteResponse | null }) {
  if (!quote || quote.freeShippingThreshold <= 0) return null;
  const pct = Math.min(100, Math.round((quote.subtotal / quote.freeShippingThreshold) * 100));
  return (
    <div className="space-y-2">
      <p className="text-sm">
        {quote.freeShippingRemaining > 0 ? (
          <>
            Add <strong>{formatPaise(quote.freeShippingRemaining)}</strong> more for free shipping.
          </>
        ) : (
          'You have free shipping.'
        )}
      </p>
      <div
        className="h-1 w-full bg-line"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Progress to free shipping"
      >
        <div className="h-1 bg-ink transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function CouponForm({ couponCode, quote }: { couponCode?: string; quote: QuoteResponse | null }) {
  const [value, setValue] = useState('');
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim()) applyCoupon(value);
    setValue('');
  };
  if (couponCode) {
    return (
      <div className="flex items-center justify-between text-sm">
        <span>
          Code <strong>{couponCode}</strong>
          {quote?.couponError ? <span className="block text-sale">{quote.couponError}</span> : null}
        </span>
        <button type="button" className="underline" onClick={() => applyCoupon(undefined)}>
          Remove
        </button>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex items-end gap-2">
      <Input
        label="Discount code"
        name="coupon"
        autoComplete="off"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="flex-1"
      />
      <Button type="submit" variant="secondary" disabled={!value.trim()}>
        Apply
      </Button>
    </form>
  );
}

export function CartTotals({ quote, className }: { quote: QuoteResponse | null; className?: string }) {
  if (!quote) return null;
  return (
    <dl className={cn('space-y-2 text-sm', className)}>
      <div className="flex justify-between">
        <dt>Subtotal</dt>
        <dd className="tabular-nums">{formatPaise(quote.subtotal)}</dd>
      </div>
      {quote.discount > 0 && (
        <div className="flex justify-between">
          <dt>Discount{quote.couponCode ? ` (${quote.couponCode})` : ''}</dt>
          <dd className="tabular-nums">−{formatPaise(quote.discount)}</dd>
        </div>
      )}
      <div className="flex justify-between">
        <dt>Shipping</dt>
        <dd className="tabular-nums">{quote.shipping ? formatPaise(quote.shipping) : 'Free'}</dd>
      </div>
      <div className="flex justify-between border-t border-line pt-2 text-base font-medium">
        <dt>Total</dt>
        <dd className="tabular-nums">{formatPaise(quote.total)}</dd>
      </div>
      <p className="text-xs text-muted">Prices include GST.{quote.shippingEta ? ` ${quote.shippingEta}.` : ''}</p>
    </dl>
  );
}
