'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Button, Input } from '@/components/ui';
import { Swatch } from '@/components/ui/Swatch';
import { SizeSelector } from '@/components/ui/SizeSelector';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { formatPaise } from '@/lib/money';
import { validateDetails, type DetailErrors } from '@/lib/commerce/checkout-details';
import { AddressFieldset, BillingFields, Check, ContactFields } from '../checkout/fields';
import { TrustLine } from '../checkout/CheckoutView';
import { payDeposit, useCheckoutDetails } from '../checkout/flow';
import { checkoutParams, track } from '@/lib/analytics/meta';

export interface BookingFormProps {
  slug: string;
  colours: { id: string; name: string; hex?: string }[];
  /** `deposit` = server-computed deposit per unit, for display only. */
  variants: { sku: string; colourId: string; size: string; deposit: number }[];
  perCustomerLimit: number;
  access: 'public' | 'code' | 'waitlist';
  initialCode?: string;
  ctaLabel: string;
  /** Size display order. */
  sizes?: string[];
  /** Meta InitiateCheckout on page load: product id, and the per-unit deposit (paise) when the price is public. */
  analytics?: { productId: string; deposit?: number };
}

/** A13 /book/{slug}: choose colour + size, pay the deposit, land on /pay/{token}. */
export function BookingForm(p: BookingFormProps) {
  const router = useRouter();
  const [colourId, setColourId] = useState(p.colours[0]?.id ?? '');
  const [size, setSize] = useState('');
  const [qty, setQty] = useState(1);
  const [code, setCode] = useState(p.initialCode ?? '');
  const [accept, setAccept] = useState(false);
  const [addAddress, setAddAddress] = useState(false);
  const { details, setDetails } = useCheckoutDetails();
  const [errors, setErrors] = useState<DetailErrors>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sizeOrder = useMemo(() => p.sizes ?? [...new Set(p.variants.map((v) => v.size))], [p.sizes, p.variants]);
  const variant = p.variants.find((v) => v.colourId === colourId && v.size === size);

  // Meta InitiateCheckout once per /book visit (no size chosen yet: product id).
  const initiated = useRef(false);
  const a = p.analytics;
  useEffect(() => {
    if (initiated.current || !a) return;
    initiated.current = true;
    track('InitiateCheckout', checkoutParams([{ productId: a.productId, qty: 1 }], a.deposit));
  }, [a]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const v = validateDetails(details, { requireAddress: addAddress });
    if (!variant) v.size = 'Choose a size.';
    if (p.access === 'code' && !code.trim()) v.code = 'Enter your access code.';
    if (!accept) v.accept = 'Please accept the booking terms.';
    setErrors(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      const out = await payDeposit({ slug: p.slug, sku: variant!.sku, qty, code: p.access === 'code' ? code.trim() : undefined, details });
      if (out.result === 'paid') router.push(`/pay/${out.token}`);
      else setBusy(false);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-10">
      <div className="space-y-6">
        {p.colours.length > 1 && (
          <Swatch
            options={p.colours.map((c) => ({ value: c.id, label: c.name, hex: c.hex }))}
            value={colourId}
            onChange={(id) => {
              setColourId(id);
              setSize('');
            }}
          />
        )}
        <SizeSelector
          options={sizeOrder.map((s) => ({ value: s, label: s, disabled: !p.variants.some((v) => v.colourId === colourId && v.size === s) }))}
          value={size}
          onChange={setSize}
          error={errors.size}
        />
        {p.perCustomerLimit > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-label uppercase text-ink">Quantity</span>
            <QuantityStepper size="sm" value={qty} min={1} max={Math.min(10, p.perCustomerLimit)} onChange={setQty} />
          </div>
        )}
      </div>

      <section className="space-y-4" aria-label="Your details">
        <p className="border-b border-line pb-3 text-label uppercase text-ink">Your details</p>
        {!addAddress && (
          <Input
            labelStyle="floating"
            label="Full name"
            autoComplete="name"
            value={details.ship.name}
            onChange={(e) => setDetails({ ...details, ship: { ...details.ship, name: e.target.value } })}
            error={errors['ship.name']}
            required
          />
        )}
        <ContactFields
          value={details}
          onChange={setDetails}
          errors={errors}
          emailHint={p.access === 'waitlist' ? 'Use the email you joined the waitlist with.' : 'Your private balance link is sent here.'}
        />
        {p.access === 'code' && (
          <Input labelStyle="floating" label="Access code" value={code} onChange={(e) => setCode(e.target.value)} error={errors.code} required />
        )}
      </section>

      <section className="space-y-4" aria-label="Delivery">
        <div className="flex items-baseline justify-between border-b border-line pb-3">
          <p className="text-label uppercase text-ink">Delivery address</p>
          <button type="button" className="text-caption text-muted underline underline-offset-4 hover:text-ink" onClick={() => setAddAddress((a) => !a)}>
            {addAddress ? 'Add later' : 'Add now'}
          </button>
        </div>
        {addAddress ? (
          <>
            <AddressFieldset prefix="ship" value={details.ship} onChange={(ship) => setDetails({ ...details, ship })} errors={errors} />
            <BillingFields value={details} onChange={setDetails} errors={errors} />
          </>
        ) : (
          <p className="text-caption text-muted">Optional now — saves time when you pay the balance.</p>
        )}
      </section>

      <div className="space-y-4 border-t border-ink pt-6">
        <Check checked={accept} onChange={setAccept}>
          I have read and accept the booking terms
        </Check>
        {errors.accept && <p className="text-caption text-sale">{errors.accept}</p>}
        {error && (
          <p role="alert" className="border-l border-sale pl-3 text-small text-sale">
            {error}
          </p>
        )}
        <Button type="submit" fullWidth size="lg" loading={busy} disabled={busy}>
          {variant ? `${p.ctaLabel} · ${formatPaise(variant.deposit * qty)}` : p.ctaLabel}
        </Button>
        <TrustLine />
      </div>
    </form>
  );
}
