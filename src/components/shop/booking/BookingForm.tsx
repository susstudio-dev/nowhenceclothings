'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';
import { Button, Input, Select } from '@/components/ui';
import { formatPaise } from '@/lib/money';
import { payWithRazorpay, type CheckoutOpts } from './pay';

export interface BookingFormProps {
  slug: string;
  colours: { id: string; name: string }[];
  /** `deposit` = server-computed deposit per unit, for display only. */
  variants: { sku: string; colourId: string; size: string; deposit: number }[];
  perCustomerLimit: number;
  access: 'public' | 'code' | 'waitlist';
  initialCode?: string;
  ctaLabel: string;
}

/** A13 /book/{slug}: choose colour + size, pay the deposit, land on /pay/{token}. */
export function BookingForm(p: BookingFormProps) {
  const router = useRouter();
  const [colourId, setColourId] = useState(p.colours[0]?.id ?? '');
  const sizes = useMemo(() => p.variants.filter((v) => v.colourId === colourId), [p.variants, colourId]);
  const [sku, setSku] = useState('');
  const [qty, setQty] = useState(1);
  const [f, setF] = useState({ name: '', email: '', phone: '', code: p.initialCode ?? '' });
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const variant = p.variants.find((v) => v.sku === sku);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!variant) return setError('Choose a size.');
    if (!accept) return setError('Please accept the booking terms.');
    setBusy(true);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: p.slug,
          sku,
          qty,
          name: f.name,
          email: f.email.trim(),
          phone: f.phone.replace(/\D/g, '').slice(-10),
          ...(p.access === 'code' ? { code: f.code.trim() } : {}),
          acceptPolicy: true,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; token?: string; number?: string; razorpay?: CheckoutOpts };
      if (!res.ok || !json.token || !json.razorpay) throw new Error(json.error || 'Booking failed. Please retry.');
      const out = await payWithRazorpay(json.razorpay, `Booking ${json.number} deposit`);
      if (out === 'paid') router.push(`/pay/${json.token}`);
      else setBusy(false);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {p.colours.length > 1 && (
        <Select
          label="Colour"
          value={colourId}
          options={p.colours.map((c) => ({ value: c.id, label: c.name }))}
          onChange={(e) => {
            setColourId(e.target.value);
            setSku('');
          }}
        />
      )}
      <fieldset>
        <legend className="mb-2 text-sm">Size</legend>
        <div className="flex flex-wrap gap-2">
          {sizes.map((v) => (
            <label
              key={v.sku}
              className={`cursor-pointer border px-4 py-2 text-sm ${sku === v.sku ? 'border-ink bg-ink text-paper' : 'border-line'}`}
            >
              <input type="radio" name="size" value={v.sku} className="sr-only" checked={sku === v.sku} onChange={() => setSku(v.sku)} />
              {v.size}
            </label>
          ))}
        </div>
      </fieldset>
      {p.perCustomerLimit > 1 && (
        <Select
          label="Quantity"
          value={String(qty)}
          options={Array.from({ length: Math.min(p.perCustomerLimit, 10) }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
          onChange={(e) => setQty(Number(e.target.value))}
        />
      )}
      <Input label="Full name" autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        value={f.email}
        onChange={(e) => setF({ ...f, email: e.target.value })}
        hint={p.access === 'waitlist' ? 'Use the email you joined the waitlist with.' : 'Your private balance link is sent here.'}
        required
      />
      <Input
        label="Mobile number"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={f.phone}
        onChange={(e) => setF({ ...f, phone: e.target.value })}
        required
      />
      {p.access === 'code' && <Input label="Access code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} required />}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
        <span>I have read and accept the booking terms above.</span>
      </label>
      {error && (
        <p role="alert" className="text-sm text-sale">
          {error}
        </p>
      )}
      <Button type="submit" fullWidth size="lg" loading={busy} disabled={busy}>
        {variant ? `${p.ctaLabel} · ${formatPaise(variant.deposit * qty)}` : p.ctaLabel}
      </Button>
    </form>
  );
}
