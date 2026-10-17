'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button, Input } from '@/components/ui';
import { formatPaise } from '@/lib/money';
import { payWithRazorpay, type CheckoutOpts } from './pay';

type Fields = Record<'name' | 'phone' | 'line1' | 'line2' | 'city' | 'state' | 'pincode', string>;

/** A13 /pay/{token}: shipping address, then pay the server-computed balance. */
export function BalanceForm({ token, name, phone, balance }: { token: string; name: string; phone: string; balance: number }) {
  const router = useRouter();
  const [f, setF] = useState<Fields>({ name, phone, line1: '', line2: '', city: '', state: '', pincode: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof Fields) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!f.name.trim() || !f.line1.trim() || !f.city.trim() || !f.state.trim()) return setError('Fill in your shipping address.');
    if (!/^[1-9]\d{5}$/.test(f.pincode.trim())) return setError('Enter a 6-digit PIN code.');
    setBusy(true);
    try {
      const res = await fetch(`/api/pay/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: f.phone.replace(/\D/g, '').slice(-10),
          address: { name: f.name, line1: f.line1, line2: f.line2, city: f.city, state: f.state, pincode: f.pincode.trim(), country: 'IN' },
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; number?: string; razorpay?: CheckoutOpts };
      if (!res.ok || !json.razorpay) throw new Error(json.error || 'Could not start the payment.');
      const out = await payWithRazorpay(json.razorpay, `Booking ${json.number} balance`);
      if (out === 'paid') router.refresh();
      setBusy(false);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Input label="Full name" autoComplete="name" value={f.name} onChange={set('name')} required />
      <Input label="Mobile number" type="tel" inputMode="numeric" autoComplete="tel-national" value={f.phone} onChange={set('phone')} required />
      <Input label="Address" autoComplete="address-line1" value={f.line1} onChange={set('line1')} required />
      <Input label="Apartment, landmark (optional)" autoComplete="address-line2" value={f.line2} onChange={set('line2')} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="City" autoComplete="address-level2" value={f.city} onChange={set('city')} required />
        <Input label="State" autoComplete="address-level1" value={f.state} onChange={set('state')} required />
        <Input label="PIN code" inputMode="numeric" maxLength={6} autoComplete="postal-code" value={f.pincode} onChange={set('pincode')} required />
      </div>
      {error && (
        <p role="alert" className="text-sm text-sale">
          {error}
        </p>
      )}
      <Button type="submit" fullWidth size="lg" loading={busy} disabled={busy}>
        Pay balance · {formatPaise(balance)}
      </Button>
    </form>
  );
}
