'use client';
// A16: buy (or reserve) one piece without leaving the page. A sheet over the
// current page runs the same checkout as /checkout (or the deposit booking),
// then Razorpay opens on top of it. Prices shown come from the server.

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button, Image, Input, cn } from '@/components/ui';
import type { MediaRef } from '@/lib/schemas/common';
import { Sheet } from '@/components/ui/Sheet';
import { Swatch } from '@/components/ui/Swatch';
import { SizeSelector } from '@/components/ui/SizeSelector';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { validateDetails, type DetailErrors } from '@/lib/commerce/checkout-details';
import type { QuoteResponse } from '@/lib/commerce/types';
import { formatPaise } from '@/lib/money';
import { formatShipBy } from '../cart-lines';
import { storedPresaleCode } from '../PresaleAccessGate';
import { AddressFieldset, BillingFields, Check, ContactFields } from './fields';
import { TrustLine } from './CheckoutView';
import { payDeposit, payForOrder, useCheckoutDetails } from './flow';
import { preorderShipLine, reserveHowItWorks } from '../presale-copy';
import { RESERVE_SEPARATE_NOTE } from '../quick-buy';

/** Structural subset of a (public) catalogue product. */
export interface QuickBuyProduct {
  slug: string;
  title: string;
  colours: { id: string; name: string; hex?: string; images?: MediaRef[] }[];
  sizes?: readonly string[];
  variants: { sku: string; colourId: string; size: string }[];
}

export type QuickBuyMode = 'deposit' | 'full' | 'buy';

export interface QuickBuySheetProps {
  product: QuickBuyProduct;
  colourId: string;
  size: string;
  /** deposit = A13 pre-booking; full = A11 pre-order paid in full; buy = in-stock. */
  mode: QuickBuyMode;
  onClose: () => void;
  /** Defaults to true: mount to open, unmount (via onClose) to close. */
  open?: boolean;
  /** Presale access code, when the page already has one. */
  accessCode?: string;
  /** Sizes known to be unavailable (sold out / cap reached). */
  unavailableSizes?: readonly string[];
}

interface DepositQuote {
  unitPrice: number;
  deposit: number;
  perCustomerLimit: number;
  access: 'public' | 'code' | 'waitlist';
  ctaLabel: string;
  terms: { saleStartsAt?: string; balanceWindowDays: number; priceLock: 'booking' | 'sale'; depositRefundable: boolean; unpaidOutcome: string };
}

function usePricing(mode: QuickBuyMode, slug: string, sku: string | undefined, qty: number) {
  const [order, setOrder] = useState<QuoteResponse | null>(null);
  const [deposit, setDeposit] = useState<DepositQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!sku) return;
    const ctl = new AbortController();
    setLoading(true);
    setError(null);
    const t = setTimeout(async () => {
      try {
        if (mode === 'deposit') {
          const res = await fetch(`/api/bookings/quote?slug=${encodeURIComponent(slug)}&sku=${encodeURIComponent(sku)}&qty=${qty}`, { signal: ctl.signal });
          const j = await res.json();
          if (!res.ok) throw new Error(j.error || 'Could not price this booking.');
          setDeposit(j as DepositQuote);
        } else {
          const res = await fetch('/api/checkout/quote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lines: [{ sku, qty }] }),
            signal: ctl.signal,
          });
          const j = await res.json();
          if (!res.ok) throw new Error(j.error || 'Could not price this piece.');
          setOrder(j as QuoteResponse);
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setError((err as Error).message);
      } finally {
        if (!ctl.signal.aborted) setLoading(false);
      }
    }, 80);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [mode, slug, sku, qty]);
  return { order, deposit, error, loading };
}

export function QuickBuySheet({ product, colourId: initialColour, size: initialSize, mode, onClose, open = true, accessCode, unavailableSizes = [] }: QuickBuySheetProps) {
  const router = useRouter();
  const [colourId, setColourId] = useState(initialColour || product.colours[0]?.id || '');
  const [size, setSize] = useState(initialSize);
  const [qty, setQty] = useState(1);
  const { details, setDetails } = useCheckoutDetails();
  const [errors, setErrors] = useState<DetailErrors>({});
  const [addAddress, setAddAddress] = useState(mode !== 'deposit');
  const [showBilling, setShowBilling] = useState(false);
  const [code, setCode] = useState(accessCode ?? '');
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessCode) {
      const s = storedPresaleCode();
      if (s) setCode(s);
    }
  }, [accessCode]);
  // A remembered address means one less tap: show it.
  useEffect(() => {
    if (details.ship.line1) setAddAddress(true);
    if (!details.billingSame || details.wantGst) setShowBilling(true);
  }, [details.ship.line1, details.billingSame, details.wantGst]);

  const colour = product.colours.find((c) => c.id === colourId) ?? product.colours[0];
  const variant = product.variants.find((v) => v.colourId === colourId && v.size === size);
  const sizes = useMemo(() => {
    const order = product.sizes?.length ? [...product.sizes] : [...new Set(product.variants.map((v) => v.size))];
    return order.map((s) => ({
      value: s,
      label: s,
      disabled: !product.variants.some((v) => v.colourId === colourId && v.size === s) || unavailableSizes.includes(s),
    }));
  }, [product, colourId, unavailableSizes]);
  const { order, deposit, error: priceError, loading } = usePricing(mode, product.slug, variant?.sku, qty);
  const line = order?.lines[0];
  const limit = mode === 'deposit' ? Math.min(10, deposit?.perCustomerLimit ?? 1) : Math.min(10, Math.max(1, line?.available ?? 10));
  const needsCode = mode === 'deposit' ? deposit?.access === 'code' : order?.preorder?.access === 'code';
  const amount = mode === 'deposit' ? deposit?.deposit : order?.total;
  const blocked = mode !== 'deposit' && Boolean(order?.issues.length);

  const cta =
    amount == null
      ? mode === 'deposit'
        ? 'Reserve'
        : 'Pay'
      : mode === 'deposit'
        ? `Reserve for ${formatPaise(amount)}`
        : mode === 'full'
          ? `Pre-order · ${formatPaise(amount)}`
          : `Pay ${formatPaise(amount)}`;

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    setFormError(null);
    if (!variant) {
      setErrors({ size: 'Choose a size.' });
      return;
    }
    const v = validateDetails(details, { requireAddress: mode !== 'deposit' || addAddress });
    if (needsCode && !code.trim()) v.code = 'Enter your access code.';
    if (mode === 'deposit' && !accept) v.accept = 'Please accept the booking terms.';
    setErrors(v);
    if (Object.keys(v).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[role="dialog"] [aria-invalid="true"]')?.focus());
      return;
    }
    setBusy(true);
    try {
      if (mode === 'deposit') {
        const out = await payDeposit({ slug: product.slug, sku: variant.sku, qty, code: needsCode ? code.trim() : undefined, details });
        if (out.result === 'paid') return router.push(`/pay/${out.token}`);
      } else {
        const out = await payForOrder({ lines: [{ sku: variant.sku, qty }], presaleAccessCode: needsCode ? code.trim() : undefined, details });
        if (out.result === 'paid') return router.push('/checkout/confirmation');
      }
      setBusy(false);
    } catch (err) {
      setFormError((err as Error).message);
      setBusy(false);
    }
  }

  const image = colour?.images?.[0];
  const title = mode === 'deposit' ? 'Reserve' : mode === 'full' ? 'Pre-order' : 'Buy now';

  return (
    <Sheet
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={title}
      className="max-h-[92dvh] w-full md:max-h-none md:max-w-[480px]"
      footer={
        <div className="space-y-3">
          {formError && (
            <p role="alert" className="border-l border-sale pl-3 text-small text-sale">
              {formError}
            </p>
          )}
          <Button type="button" onClick={() => submit()} fullWidth size="lg" loading={busy} disabled={busy || loading || blocked || !variant || amount == null}>
            {cta}
          </Button>
          <TrustLine />
        </div>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-8">
        {/* The piece */}
        <div className="flex gap-4">
          <span className="relative block aspect-garment w-[84px] shrink-0 overflow-hidden bg-paper-deep">
            {image ? <Image media={image} sizes="84px" className="absolute inset-0 h-full w-full object-cover" alt="" /> : null}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-h4 font-light leading-tight text-ink">{product.title}</p>
            <p className="mt-1 text-caption text-muted">
              {colour?.name}
              {size ? ` · ${size}` : ''}
            </p>
            <p className="mt-2 text-small tabular-nums text-ink" aria-live="polite">
              {mode === 'deposit' ? (
                deposit ? (
                  <>
                    {formatPaise(deposit.deposit)} today <span className="text-muted">· {formatPaise(deposit.unitPrice * qty)} in all</span>
                  </>
                ) : (
                  <span className="skeleton inline-block h-4 w-32 align-middle" />
                )
              ) : line ? (
                formatPaise(line.lineTotal)
              ) : (
                <span className="skeleton inline-block h-4 w-20 align-middle" />
              )}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {product.colours.length > 1 && (
            <Swatch
              size="sm"
              options={product.colours.map((c) => ({ value: c.id, label: c.name, hex: c.hex }))}
              value={colourId}
              onChange={(v) => setColourId(v)}
            />
          )}
          <SizeSelector options={sizes} value={size} onChange={(v) => setSize(v)} error={errors.size} />
          {limit > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-label uppercase text-ink">Quantity</span>
              <QuantityStepper size="sm" value={qty} min={1} max={limit} onChange={setQty} />
            </div>
          )}
        </div>

        {/* What happens next */}
        {mode === 'deposit' && deposit && (
          <div className="space-y-2 border-l border-clay pl-4 text-caption text-ink-soft">
            <p className="text-label uppercase text-clay">How reserving works</p>
            <p>
              {reserveHowItWorks({
                deposit: deposit.deposit,
                unitPrice: deposit.unitPrice,
                qty,
                priceLock: deposit.terms.priceLock,
                saleStartsAt: deposit.terms.saleStartsAt,
                balanceWindowDays: deposit.terms.balanceWindowDays,
              })}
            </p>
            <p>Deposit is {deposit.terms.depositRefundable ? 'refundable' : 'non-refundable'}. {RESERVE_SEPARATE_NOTE}</p>
          </div>
        )}
        {mode !== 'deposit' && order?.preorder && (
          <div className="space-y-1 border-l border-clay pl-4 text-caption text-ink-soft">
            <p className="text-label uppercase text-clay">Pre-order</p>
            <p>{preorderShipLine(order.preorder.shipBy, order.preorder.shipCopy, formatShipBy)}</p>
          </div>
        )}
        {(priceError || (blocked && order?.issues[0])) && (
          <p role="alert" className="text-small text-sale">
            {priceError || 'This size is no longer available.'}
          </p>
        )}

        <section className="space-y-4" aria-label="Contact">
          <p className="border-b border-line pb-3 text-label uppercase text-ink">Contact</p>
          {mode === 'deposit' && !addAddress && (
            <AddressNameOnly value={details.ship.name} onChange={(name) => setDetails({ ...details, ship: { ...details.ship, name } })} error={errors['ship.name']} />
          )}
          <ContactFields value={details} onChange={setDetails} errors={errors} emailHint={mode === 'deposit' ? 'Your private balance link is sent here.' : undefined} />
        </section>

        <section className="space-y-4" aria-label="Delivery">
          <div className="flex items-baseline justify-between border-b border-line pb-3">
            <p className="text-label uppercase text-ink">Delivery</p>
            {mode === 'deposit' && (
              <button type="button" className="text-caption text-muted underline underline-offset-4 hover:text-ink" onClick={() => setAddAddress((a) => !a)}>
                {addAddress ? 'Add later' : 'Add now'}
              </button>
            )}
          </div>
          {addAddress ? (
            <AddressFieldset prefix="ship" value={details.ship} onChange={(ship) => setDetails({ ...details, ship })} errors={errors} />
          ) : (
            <p className="text-caption text-muted">Optional for now — you can add it when you pay the balance.</p>
          )}
          {mode !== 'deposit' && order && (
            <p className="flex justify-between text-caption text-ink-soft">
              <span>Shipping</span>
              <span className="tabular-nums">{order.shipping ? formatPaise(order.shipping) : 'Complimentary'}</span>
            </p>
          )}
        </section>

        <section className="space-y-4" aria-label="Billing">
          <button
            type="button"
            onClick={() => setShowBilling((s) => !s)}
            aria-expanded={showBilling}
            className="flex w-full items-baseline justify-between border-b border-line pb-3 text-left"
          >
            <span className="text-label uppercase text-ink">Billing &amp; GST invoice</span>
            <span className="text-caption text-muted">{showBilling ? 'Hide' : details.billingSame && !details.wantGst ? 'Same as delivery' : 'Edit'}</span>
          </button>
          {showBilling && <BillingFields value={details} onChange={setDetails} errors={errors} />}
        </section>

        {needsCode && (
          <AccessCode value={code} onChange={setCode} error={errors.code} />
        )}

        <div className="space-y-3">
          {mode === 'deposit' && (
            <>
              <Check checked={accept} onChange={setAccept}>
                I accept the booking terms
              </Check>
              {errors.accept && <p className="text-caption text-sale">{errors.accept}</p>}
            </>
          )}
          <Check checked={details.remember} onChange={(remember) => setDetails({ ...details, remember })}>
            Remember my details on this device
          </Check>
        </div>
        {/* Enter submits */}
        <button type="submit" className="sr-only" tabIndex={-1}>
          {cta}
        </button>
      </form>
    </Sheet>
  );
}

function AddressNameOnly({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  return <InputLite label="Full name" autoComplete="name" value={value} onChange={onChange} error={error} />;
}

function AccessCode({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  return <InputLite label="Access code" autoComplete="off" value={value} onChange={onChange} error={error} />;
}

function InputLite({ label, value, onChange, error, autoComplete }: { label: string; value: string; onChange: (v: string) => void; error?: string; autoComplete?: string }) {
  return (
    <Input labelStyle="floating" label={label} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} error={error} className={cn(error && 'animate-fade-in')} required />
  );
}
