'use client';
// A15 single-page checkout: contact → delivery → billing → pay, with the bag
// summary beside (desktop) or folded above (mobile). Razorpay opens in-page.

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button, Input, cn } from '@/components/ui';
import { IconChevronDown } from '@/components/ui/icons';
import { clearCart, useCart } from '@/lib/commerce/cart-client';
import { useQuote } from '@/lib/commerce/use-quote';
import { validateDetails, type DetailErrors } from '@/lib/commerce/checkout-details';
import { formatPaise } from '@/lib/money';
import { CartLines, CartTotals, CouponForm, PresaleNotice, formatShipBy } from '../cart-lines';
import { EmptyBag } from '../cart-drawer';
import { storedPresaleCode } from '../PresaleAccessGate';
import { AddressFieldset, BillingFields, Check, ContactFields, Step } from './fields';
import { FlowError, payForOrder, useCheckoutDetails } from './flow';

export function TrustLine({ className }: { className?: string }) {
  return (
    <p className={cn('flex items-center justify-center gap-2 text-caption text-muted', className)}>
      <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.2">
        <rect x="3" y="7" width="10" height="7" />
        <path d="M5 7V5a3 3 0 0 1 6 0v2" />
      </svg>
      Secure payment by Razorpay · UPI, cards, netbanking, wallets
    </p>
  );
}

export function CheckoutView() {
  const router = useRouter();
  const cart = useCart();
  const { quote, loading: quoting, error: quoteError } = useQuote(cart.lines, cart.couponCode);
  const { details, setDetails, remembered } = useCheckoutDetails();
  const [errors, setErrors] = useState<DetailErrors>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [accessCode, setAccessCode] = useState('');
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
    const saved = storedPresaleCode();
    if (saved) setAccessCode(saved);
  }, []);

  const firstError = useMemo(() => Object.keys(errors)[0], [errors]);
  useEffect(() => {
    if (!firstError) return;
    const el = document.querySelector<HTMLElement>('[aria-invalid="true"]');
    el?.focus({ preventScroll: false });
  }, [firstError]);

  if (!hydrated) return <div className="min-h-[60vh]" aria-busy="true" />;
  if (!cart.lines.length) return <EmptyBag />;

  const blocked = Boolean(quote?.issues.length) || Boolean(quote?.mixedPresale);
  const needsCode = quote?.preorder?.access === 'code';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const v = validateDetails(details);
    if (needsCode && !accessCode.trim()) v.accessCode = 'Enter your access code.';
    setErrors(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      const out = await payForOrder({
        lines: cart.lines.map((l) => ({ sku: l.sku, qty: l.qty })),
        couponCode: cart.couponCode,
        presaleAccessCode: needsCode ? accessCode.trim() : undefined,
        details,
      });
      if (out.result === 'paid') {
        clearCart();
        router.push('/checkout/confirmation');
        return;
      }
      setBusy(false);
    } catch (err) {
      setFormError(err instanceof FlowError || err instanceof Error ? err.message : 'Checkout failed.');
      setBusy(false);
    }
  }

  const total = quote ? formatPaise(quote.total) : '';
  const summary = (
    <div className="space-y-6">
      <PresaleNotice quote={quote} />
      <CartLines lines={cart.lines} quote={quote} compact readOnly />
      <div className="border-t border-line pt-5">
        <CouponForm couponCode={cart.couponCode} quote={quote} />
      </div>
      <CartTotals quote={quote} className="border-t border-line pt-5" />
    </div>
  );

  return (
    <div className="mx-auto max-w-[68rem] lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-0">
      {/* Mobile: folded summary */}
      <div className="-mx-gutter mb-8 border-y border-line bg-paper-deep/60 lg:hidden">
        <button
          type="button"
          onClick={() => setSummaryOpen((o) => !o)}
          aria-expanded={summaryOpen}
          aria-controls="checkout-summary-mobile"
          className="flex w-full items-center justify-between px-gutter py-4"
        >
          <span className="flex items-center gap-2 text-small text-ink">
            {summaryOpen ? 'Hide' : 'Show'} order summary
            <IconChevronDown size={14} className={cn('transition-transform duration-base', summaryOpen && 'rotate-180')} />
          </span>
          <span className="text-body tabular-nums text-ink">{total || '—'}</span>
        </button>
        {summaryOpen && (
          <div id="checkout-summary-mobile" className="animate-fade-in px-gutter pb-6">
            {summary}
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} noValidate className="mx-auto w-full max-w-[36rem] space-y-12 lg:mx-0 lg:pr-16 xl:pr-24" aria-describedby={formError ? 'checkout-error' : undefined}>
        <Step n="01" title="Contact" aside={remembered ? <span className="text-caption text-muted">Saved on this device</span> : undefined}>
          <ContactFields value={details} onChange={setDetails} errors={errors} emailHint="Order updates and your GST invoice are sent here." />
        </Step>

        <Step n="02" title="Delivery">
          <AddressFieldset prefix="ship" value={details.ship} onChange={(ship) => setDetails({ ...details, ship })} errors={errors} />
          <div className="flex items-start justify-between gap-4 border-t border-line pt-4 text-small">
            <span className="text-ink">
              {quote?.preorder ? 'Pre-order shipping' : 'Standard shipping'}
              <span className="mt-0.5 block text-caption text-muted">
                {quote?.preorder
                  ? quote.preorder.shipBy
                    ? `Ships by ${formatShipBy(quote.preorder.shipBy)}`
                    : quote.preorder.shipCopy
                  : quote?.shippingEta || 'Ships in 2–4 working days'}
              </span>
            </span>
            <span className="tabular-nums text-ink">{quote ? (quote.shipping ? formatPaise(quote.shipping) : 'Complimentary') : ''}</span>
          </div>
        </Step>

        <Step n="03" title="Billing">
          <BillingFields value={details} onChange={setDetails} errors={errors} />
        </Step>

        {quote?.preorder && (
          <Step n="04" title="Pre-order terms">
            <p className="text-small text-ink-soft">{quote.preorder.terms}</p>
            {quote.preorder.access === 'waitlist' && <p className="text-small text-ink">This pre-order is open to the waitlist. Use the email you signed up with.</p>}
            {needsCode && (
              <Input
                labelStyle="floating"
                label="Access code"
                autoComplete="off"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                error={errors.accessCode}
                className="max-w-xs"
                required
              />
            )}
          </Step>
        )}

        <div className="space-y-4 border-t border-ink pt-6">
          <Check checked={details.remember} onChange={(remember) => setDetails({ ...details, remember })}>
            Remember my details on this device for next time
          </Check>
          {(formError || quoteError) && (
            <p id="checkout-error" role="alert" className="border-l border-sale pl-3 text-small text-sale">
              {formError || quoteError}
            </p>
          )}
          {blocked && !quote?.mixedPresale && <p className="text-small text-sale">Some pieces in your bag are unavailable. Return to the bag to update it.</p>}
          {quote?.mixedPresale && <PresaleNotice quote={quote} />}
          <Button type="submit" fullWidth size="lg" loading={busy} disabled={busy || quoting || blocked || !quote}>
            {quote ? `Pay ${total}` : 'Pay'}
          </Button>
          <TrustLine />
        </div>
      </form>

      <aside aria-label="Order summary" className="hidden border-l border-line pl-12 lg:block xl:pl-16">
        <div className="sticky top-[calc(var(--header-h)+2rem)] space-y-6">
          <p className="border-b border-ink pb-3 text-label uppercase text-ink">In your bag</p>
          {summary}
        </div>
      </aside>
    </div>
  );
}
