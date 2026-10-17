'use client';
// A15 checkout details: contact → address (PIN auto-fill) → billing / GSTIN.
// Controlled; the parent owns `CheckoutDetails` and the errors map.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Input, Select, cn } from '@/components/ui';
import { INDIAN_STATES, validateGstin } from '@/lib/invoices/gst';
import type { AddressFields, CheckoutDetails, DetailErrors } from '@/lib/commerce/checkout-details';

const STATE_OPTIONS = INDIAN_STATES.map((s) => ({ value: s, label: s }));

/** Numbered section heading: "01 — Contact". */
export function Step({ n, title, aside, children, className }: { n: string; title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-5', className)} aria-label={title}>
      <header className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
        <h2 className="flex items-baseline gap-3 text-label uppercase text-ink">
          <span className="tabular-nums text-muted">{n}</span>
          {title}
        </h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function Check({ checked, onChange, children, className }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; className?: string }) {
  return (
    <label className={cn('group flex cursor-pointer items-start gap-3 text-small text-ink', className)}>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden="true"
        className="mt-[3px] inline-flex h-4 w-4 shrink-0 items-center justify-center border border-ink transition-colors duration-fast peer-checked:bg-ink peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink"
      >
        <svg viewBox="0 0 12 12" className={cn('h-2.5 w-2.5 text-paper', checked ? 'opacity-100' : 'opacity-0')} fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M2 6.5 5 9l5-6" />
        </svg>
      </span>
      <span className="leading-snug">{children}</span>
    </label>
  );
}

type PinState = { status: 'idle' | 'loading' | 'found' | 'missing'; city?: string; state?: string };

/** Debounced PIN lookup via /api/pincode. Never blocks typing; misses fall back to manual entry. */
function usePincode(pin: string, onFound: (city: string, state: string) => void): PinState {
  const [s, setS] = useState<PinState>({ status: 'idle' });
  const cb = useRef(onFound);
  cb.current = onFound;
  useEffect(() => {
    if (!/^[1-9]\d{5}$/.test(pin)) {
      setS({ status: 'idle' });
      return;
    }
    const ctl = new AbortController();
    setS({ status: 'loading' });
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/pincode/${pin}`, { signal: ctl.signal });
        const j = (await res.json()) as { found?: boolean; city?: string; state?: string };
        if (j.found && j.city && j.state) {
          setS({ status: 'found', city: j.city, state: j.state });
          cb.current(j.city, j.state);
        } else setS({ status: 'missing' });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setS({ status: 'missing' });
      }
    }, 120);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [pin]);
  return s;
}

/** Best match in our state list for India Post's spelling. */
function matchState(s: string): string {
  const n = (x: string) => x.toLowerCase().replace(/&/g, 'and').replace(/[^a-z]/g, '');
  return INDIAN_STATES.find((x) => n(x) === n(s)) ?? s;
}

export function AddressFieldset({
  value,
  onChange,
  errors,
  prefix,
  nameLabel = 'Full name',
  autoPrefix = 'shipping',
}: {
  value: AddressFields;
  onChange: (a: AddressFields) => void;
  errors: DetailErrors;
  prefix: 'ship' | 'bill';
  nameLabel?: string;
  autoPrefix?: 'shipping' | 'billing';
}) {
  const latest = useRef(value);
  latest.current = value;
  const autoFilled = useRef<{ city: string; state: string } | null>(null);
  const pin = usePincode(value.pincode.trim(), (city, state) => {
    const cur = latest.current;
    const prev = autoFilled.current;
    const st = matchState(state);
    // Fill when empty or still showing our previous auto-fill; never overwrite typed values.
    const next = {
      ...cur,
      city: !cur.city || cur.city === prev?.city ? city : cur.city,
      state: !cur.state || cur.state === prev?.state ? st : cur.state,
    };
    autoFilled.current = { city: next.city, state: next.state };
    if (next.city !== cur.city || next.state !== cur.state) onChange(next);
  });
  const set = (k: keyof AddressFields) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value });
  const err = (k: keyof AddressFields) => errors[`${prefix}.${k}`];
  const ac = (s: string) => `section-${autoPrefix} ${autoPrefix} ${s}`;
  const pinTrailing =
    pin.status === 'loading' ? (
      <span className="inline-block h-3 w-3 animate-spin rounded-full border border-muted border-t-transparent motion-reduce:animate-none" aria-label="Looking up PIN" />
    ) : pin.status === 'found' ? (
      <span aria-hidden="true">✓</span>
    ) : null;

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-4">
      <Input labelStyle="floating" className="col-span-2" label={nameLabel} autoComplete={ac('name')} value={value.name} onChange={set('name')} error={err('name')} required />
      <Input
        labelStyle="floating"
        className="col-span-2 sm:col-span-1"
        label="PIN code"
        inputMode="numeric"
        autoComplete={ac('postal-code')}
        maxLength={6}
        value={value.pincode}
        onChange={(e) => onChange({ ...value, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
        error={err('pincode')}
        hint={
          pin.status === 'found'
            ? `${pin.city}, ${pin.state}`
            : pin.status === 'missing'
              ? 'We could not look this PIN up — enter city and state below.'
              : undefined
        }
        trailing={pinTrailing}
        required
      />
      <div className="hidden sm:block" aria-hidden="true" />
      <Input labelStyle="floating" className="col-span-2" label="House no., building, street" autoComplete={ac('address-line1')} value={value.line1} onChange={set('line1')} error={err('line1')} required />
      <Input labelStyle="floating" className="col-span-2" label="Area, landmark (optional)" autoComplete={ac('address-line2')} value={value.line2} onChange={set('line2')} />
      <Input labelStyle="floating" className="col-span-2 sm:col-span-1" label="City" autoComplete={ac('address-level2')} value={value.city} onChange={set('city')} error={err('city')} required />
      <Select
        className="col-span-2 sm:col-span-1"
        label="State"
        hideLabel
        autoComplete={ac('address-level1')}
        placeholder="State"
        options={STATE_OPTIONS}
        value={value.state}
        onChange={set('state')}
        error={err('state')}
        required
      />
    </div>
  );
}

export function ContactFields({ value, onChange, errors, emailHint }: { value: CheckoutDetails; onChange: (d: CheckoutDetails) => void; errors: DetailErrors; emailHint?: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Input
        labelStyle="floating"
        label="Email"
        type="email"
        autoComplete="email"
        value={value.email}
        onChange={(e) => onChange({ ...value, email: e.target.value })}
        error={errors.email}
        hint={emailHint}
        required
      />
      <Input
        labelStyle="floating"
        label="Mobile"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={value.phone}
        onChange={(e) => onChange({ ...value, phone: e.target.value.replace(/[^\d+\s-]/g, '').slice(0, 16) })}
        error={errors.phone}
        trailing={<span className="tabular-nums">+91</span>}
        required
      />
    </div>
  );
}

export function BillingFields({ value, onChange, errors }: { value: CheckoutDetails; onChange: (d: CheckoutDetails) => void; errors: DetailErrors }) {
  const g = value.wantGst && value.gstin.length === 15 ? validateGstin(value.gstin) : null;
  return (
    <div className="space-y-4">
      <Check checked={value.billingSame} onChange={(v) => onChange({ ...value, billingSame: v })}>
        Billing address is the same as delivery
      </Check>
      {!value.billingSame && (
        <div className="animate-fade-in border-l border-line pl-4">
          <AddressFieldset prefix="bill" autoPrefix="billing" nameLabel="Billing name or company" value={value.bill} onChange={(bill) => onChange({ ...value, bill })} errors={errors} />
        </div>
      )}
      <Check checked={value.wantGst} onChange={(v) => onChange({ ...value, wantGst: v })}>
        I need a GST invoice for my business
      </Check>
      {value.wantGst && (
        <div className="animate-fade-in border-l border-line pl-4">
          <Input
            labelStyle="floating"
            label="GSTIN"
            autoComplete="off"
            maxLength={15}
            value={value.gstin}
            onChange={(e) => onChange({ ...value, gstin: e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '') })}
            error={errors.gstin}
            hint={g?.ok ? `Registered in ${g.state}` : 'Your business name goes on the invoice from the billing name.'}
            className="max-w-sm"
          />
        </div>
      )}
    </div>
  );
}
