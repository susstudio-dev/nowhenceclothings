'use client';
// Bag line items, coupon, free-shipping progress and totals. Shared by the
// cart drawer, /cart and the checkout summary. Prices always come from the
// server quote; the cart only stores sku + qty (+ display hints).

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { cn } from '@/components/ui';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { Badge } from '@/components/ui/Badge';
import { applyCoupon, MAX_QTY, removeLine, updateQty, type CartLine } from '@/lib/commerce/cart-client';
import { ISSUE_TEXT } from '@/lib/commerce/use-quote';
import type { QuoteResponse } from '@/lib/commerce/types';
import { formatPaise } from '@/lib/money';
import { MIXED_CART_MESSAGE } from '@/lib/launches';

export function formatShipBy(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00+05:30` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

export function LineThumb({ src, alt = '', className }: { src?: string; alt?: string; className?: string }) {
  return (
    <span className={cn('relative block aspect-garment w-[76px] shrink-0 overflow-hidden bg-paper-deep', className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
          <span className="h-5 w-5 rounded-full border border-line" />
        </span>
      )}
    </span>
  );
}

export function CartLines({
  lines,
  quote,
  compact = false,
  readOnly = false,
  onNavigate,
}: {
  lines: CartLine[];
  quote: QuoteResponse | null;
  compact?: boolean;
  /** Checkout summary: no stepper / remove. */
  readOnly?: boolean;
  onNavigate?: () => void;
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
        const compareAt = q?.compareAtPrice;
        return (
          <li key={line.sku} className={cn('flex gap-4', compact ? 'py-4' : 'py-6')}>
            <Link href={href} onClick={onNavigate} className="shrink-0" tabIndex={-1} aria-hidden="true">
              <LineThumb src={image} className={compact ? 'w-[64px]' : 'w-[88px] sm:w-[104px]'} />
              {readOnly && line.qty > 1 && (
                <span className="sr-only">Quantity {line.qty}</span>
              )}
            </Link>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={href} onClick={onNavigate} className="block truncate text-small text-ink hover:opacity-70">
                    {title}
                  </Link>
                  <p className="mt-0.5 text-caption text-muted">
                    {line.colour} · {line.size}
                    {readOnly ? ` · Qty ${line.qty}` : ''}
                  </p>
                </div>
                <p className="shrink-0 text-right text-small tabular-nums">
                  {compareAt && compareAt > unit && (
                    <s className="mr-2 text-caption text-muted">{formatPaise(compareAt * line.qty)}</s>
                  )}
                  <span className={compareAt && compareAt > unit ? 'text-sale' : undefined}>{formatPaise(unit * line.qty)}</span>
                </p>
              </div>
              {q?.preorder && (
                <p className="mt-2">
                  <Badge tone="clay">Pre-order · {q.shipBy ? `ships by ${formatShipBy(q.shipBy)}` : q.shipCopy}</Badge>
                </p>
              )}
              {issue && (
                <p className="mt-2 text-caption text-sale" role="status">
                  {issue.issue === 'presale_limit' && issue.available
                    ? `Pre-orders are limited to ${issue.available} per customer — quantity reduced.`
                    : ISSUE_TEXT[issue.issue]}
                </p>
              )}
              {!readOnly && (
                <div className="mt-auto flex items-center justify-between pt-3">
                  <QuantityStepper size="sm" value={line.qty} min={1} max={Math.max(1, maxQty)} label={`Quantity, ${title}`} onChange={(n) => updateQty(line.sku, n)} />
                  <button
                    type="button"
                    className="text-caption text-muted underline decoration-line underline-offset-4 transition-colors duration-fast hover:text-ink hover:decoration-ink"
                    onClick={() => removeLine(line.sku)}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function FreeShippingProgress({ quote }: { quote: QuoteResponse | null }) {
  if (!quote || quote.freeShippingThreshold <= 0 || quote.preorder) return null;
  const pct = Math.min(100, Math.round((quote.subtotal / quote.freeShippingThreshold) * 100));
  const done = quote.freeShippingRemaining <= 0;
  return (
    <div className="space-y-2.5">
      <p className="text-caption text-ink-soft">
        {done ? (
          'Complimentary shipping on this order.'
        ) : (
          <>
            <span className="tabular-nums text-ink">{formatPaise(quote.freeShippingRemaining)}</span> away from complimentary shipping
          </>
        )}
      </p>
      <div
        className="h-px w-full bg-line"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Progress to complimentary shipping"
      >
        <div className="h-px bg-ink transition-[width] duration-slow ease-out motion-reduce:transition-none" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Pre-order / mixed-bag messaging for the bag and checkout. */
export function PresaleNotice({ quote }: { quote: QuoteResponse | null }) {
  if (!quote) return null;
  if (quote.mixedPresale)
    return (
      <p role="alert" className="border-l border-sale pl-3 text-caption text-sale">
        {MIXED_CART_MESSAGE}
      </p>
    );
  if (quote.preorder)
    return (
      <div className="space-y-1 border-l border-clay pl-3">
        <p className="text-label uppercase text-clay">Pre-order</p>
        <p className="text-caption text-ink-soft">
          {quote.preorder.shipBy ? `Ships by ${formatShipBy(quote.preorder.shipBy)}. ` : ''}
          {quote.preorder.shipCopy}
        </p>
      </div>
    );
  return null;
}

export function CouponForm({ couponCode, quote }: { couponCode?: string; quote: QuoteResponse | null }) {
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim()) applyCoupon(value.trim().toUpperCase());
    setValue('');
  };
  if (couponCode) {
    return (
      <div className="flex items-center justify-between gap-3 text-small">
        <span className="min-w-0">
          <span className="care-tag text-ink">{couponCode}</span>
          {quote?.couponError ? <span className="mt-1 block text-caption text-sale">{quote.couponError}</span> : null}
        </span>
        <button type="button" className="text-caption text-muted underline underline-offset-4 hover:text-ink" onClick={() => applyCoupon(undefined)}>
          Remove
        </button>
      </div>
    );
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-caption text-ink-soft underline decoration-line underline-offset-4 hover:decoration-ink">
        Have a discount code?
      </button>
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex animate-fade-in border-b border-ink">
      <label htmlFor="coupon" className="sr-only">
        Discount code
      </label>
      <input
        id="coupon"
        name="coupon"
        autoComplete="off"
        autoFocus
        placeholder="Discount code"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-11 min-w-0 flex-1 bg-transparent text-small uppercase tracking-wide text-ink placeholder:normal-case placeholder:tracking-normal placeholder:text-muted focus:outline-none"
      />
      <button type="submit" disabled={!value.trim()} className="px-1 text-label uppercase text-ink disabled:text-muted">
        Apply
      </button>
    </form>
  );
}

export function CartTotals({ quote, className, totalLabel = 'Total' }: { quote: QuoteResponse | null; className?: string; totalLabel?: string }) {
  if (!quote) {
    return (
      <div className={cn('space-y-3', className)} aria-busy="true">
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-2/3" />
      </div>
    );
  }
  return (
    <dl className={cn('space-y-2.5 text-small', className)}>
      <div className="flex justify-between text-ink-soft">
        <dt>Subtotal</dt>
        <dd className="tabular-nums">{formatPaise(quote.subtotal)}</dd>
      </div>
      {quote.discount > 0 && (
        <div className="flex justify-between text-ink-soft">
          <dt>Discount{quote.couponCode ? ` · ${quote.couponCode}` : ''}</dt>
          <dd className="tabular-nums">−{formatPaise(quote.discount)}</dd>
        </div>
      )}
      <div className="flex justify-between text-ink-soft">
        <dt>Shipping</dt>
        <dd className="tabular-nums">{quote.shipping ? formatPaise(quote.shipping) : 'Complimentary'}</dd>
      </div>
      <div className="flex items-baseline justify-between border-t border-line pt-3">
        <dt className="text-small text-ink">{totalLabel}</dt>
        <dd className="text-lead tabular-nums text-ink">{formatPaise(quote.total)}</dd>
      </div>
      <p className="text-caption text-muted">Inclusive of GST. A tax invoice is emailed with your order.</p>
    </dl>
  );
}
