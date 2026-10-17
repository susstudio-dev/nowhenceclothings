'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui';
import { formatPaise } from '@/lib/money';
import { EMPTY_ADDRESS, detailsPayload, saveRemembered, validateDetails, type AddressFields, type DetailErrors } from '@/lib/commerce/checkout-details';
import { AddressFieldset, BillingFields, ContactFields } from '../checkout/fields';
import { TrustLine } from '../checkout/CheckoutView';
import { useCheckoutDetails } from '../checkout/flow';
import { payWithRazorpay, type CheckoutOpts } from './pay';

/** A13 /pay/{token}: delivery + billing address, then pay the server-computed balance. */
export function BalanceForm({
  token,
  name,
  phone,
  email,
  balance,
  address,
}: {
  token: string;
  name: string;
  phone: string;
  balance: number;
  email?: string;
  /** Address given at booking, if any. */
  address?: AddressFields;
}) {
  const router = useRouter();
  const { details, setDetails } = useCheckoutDetails();
  const [errors, setErrors] = useState<DetailErrors>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The booking is the source of truth for contact; fill gaps from this device.
  useEffect(() => {
    setDetails((d) => ({
      ...d,
      email: email ?? d.email,
      phone: phone || d.phone,
      ship: address ?? (d.ship.line1 ? d.ship : { ...EMPTY_ADDRESS, name }),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const v = validateDetails(details);
    setErrors(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      const p = detailsPayload(details);
      const res = await fetch(`/api/pay/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: p.phone,
          address: p.address,
          ...(p.billingAddress ? { billingAddress: p.billingAddress } : {}),
          ...(p.gstin ? { gstin: p.gstin } : {}),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; number?: string; razorpay?: CheckoutOpts };
      if (!res.ok || !json.razorpay) throw new Error(json.error || 'Could not start the payment.');
      saveRemembered(details);
      const out = await payWithRazorpay(json.razorpay, `Booking ${json.number} balance`);
      if (out === 'paid') router.refresh();
      setBusy(false);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-10">
      <section className="space-y-4" aria-label="Contact">
        <p className="border-b border-line pb-3 text-label uppercase text-ink">Contact</p>
        <ContactFields value={details} onChange={setDetails} errors={errors} />
      </section>
      <section className="space-y-4" aria-label="Delivery">
        <p className="border-b border-line pb-3 text-label uppercase text-ink">Delivery</p>
        <AddressFieldset prefix="ship" value={details.ship} onChange={(ship) => setDetails({ ...details, ship })} errors={errors} />
      </section>
      <section className="space-y-4" aria-label="Billing">
        <p className="border-b border-line pb-3 text-label uppercase text-ink">Billing</p>
        <BillingFields value={details} onChange={setDetails} errors={errors} />
      </section>
      <div className="space-y-4 border-t border-ink pt-6">
        {error && (
          <p role="alert" className="border-l border-sale pl-3 text-small text-sale">
            {error}
          </p>
        )}
        <Button type="submit" fullWidth size="lg" loading={busy} disabled={busy}>
          Pay balance · {formatPaise(balance)}
        </Button>
        <TrustLine />
      </div>
    </form>
  );
}
