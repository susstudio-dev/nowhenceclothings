'use client';

import { useState } from 'react';
import type { SettingsDoc } from '@/lib/schemas/settings';
import { Button, Input } from '@/components/ui';
import { adminFetch, toPaise, toRupees } from './api-client';

export function SettingsForm({ initial, canEdit }: { initial: SettingsDoc; canEdit: boolean }) {
  const [s, setS] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const sec = <K extends keyof SettingsDoc>(k: K, patch: Partial<SettingsDoc[K]>) =>
    setS((cur) => ({ ...cur, [k]: { ...(cur[k] as object), ...patch } }));

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const { settings } = await adminFetch<{ settings: SettingsDoc }>('/api/admin/settings', { method: 'PUT', body: s });
      setS(settings);
      setMsg({ ok: true, text: 'Saved' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <fieldset disabled={!canEdit} className="grid gap-4 md:grid-cols-3">
        <legend className="mb-2 text-lg">Shipping</legend>
        <Input label="Flat fee (₹)" type="number" min={0} value={toRupees(s.shipping.flatFee)} onChange={(e) => sec('shipping', { flatFee: toPaise(e.target.value) ?? 0 })} />
        <Input
          label="Free shipping from (₹)"
          type="number"
          min={0}
          value={toRupees(s.shipping.freeShippingThreshold)}
          onChange={(e) => sec('shipping', { freeShippingThreshold: toPaise(e.target.value) ?? 0 })}
        />
        <Input label="Delivery estimate" value={s.shipping.eta} onChange={(e) => sec('shipping', { eta: e.target.value })} />
      </fieldset>
      <fieldset disabled={!canEdit} className="grid gap-4 md:grid-cols-3">
        <legend className="mb-2 text-lg">Tax</legend>
        <Input label="GST rate (%)" type="number" min={0} max={28} value={s.tax.gstRatePercent} onChange={(e) => sec('tax', { gstRatePercent: Number(e.target.value) })} />
        <Input label="GSTIN" value={s.tax.gstin} onChange={(e) => sec('tax', { gstin: e.target.value })} />
      </fieldset>
      <fieldset disabled={!canEdit} className="grid gap-4 md:grid-cols-3">
        <legend className="mb-2 text-lg">Store</legend>
        <Input label="Name" value={s.store.name} onChange={(e) => sec('store', { name: e.target.value })} />
        <Input label="Legal name" value={s.store.legalName} onChange={(e) => sec('store', { legalName: e.target.value })} />
        <Input label="Email" type="email" value={s.store.email} onChange={(e) => sec('store', { email: e.target.value })} />
        <Input label="Phone" value={s.store.phone} onChange={(e) => sec('store', { phone: e.target.value })} />
        <Input label="Address" value={s.store.address} onChange={(e) => sec('store', { address: e.target.value })} />
        <Input label="Instagram" value={s.store.instagram} onChange={(e) => sec('store', { instagram: e.target.value })} />
      </fieldset>
      <fieldset disabled={!canEdit} className="grid gap-4 md:grid-cols-3">
        <legend className="mb-2 text-lg">Orders</legend>
        <Input
          label="Payment window (minutes)"
          type="number"
          min={1}
          value={s.orders.paymentWindowMinutes}
          onChange={(e) => sec('orders', { paymentWindowMinutes: Math.trunc(Number(e.target.value)) })}
        />
        <Input
          label="Return window (days)"
          type="number"
          min={0}
          value={s.orders.returnWindowDays}
          onChange={(e) => sec('orders', { returnWindowDays: Math.trunc(Number(e.target.value)) })}
        />
        <Input
          label="Max units per line"
          type="number"
          min={1}
          value={s.orders.maxQtyPerLine}
          onChange={(e) => sec('orders', { maxQtyPerLine: Math.trunc(Number(e.target.value)) })}
        />
      </fieldset>
      <fieldset disabled={!canEdit} className="grid gap-4 md:grid-cols-2">
        <legend className="mb-2 text-lg">Email</legend>
        <Input label="From" value={s.email.from} onChange={(e) => sec('email', { from: e.target.value })} />
        <Input label="Reply-to" value={s.email.replyTo} onChange={(e) => sec('email', { replyTo: e.target.value })} />
      </fieldset>
      {canEdit ? (
        <div className="flex items-center gap-3">
          <Button type="submit" loading={busy}>
            Save settings
          </Button>
          {msg && (
            <span role="status" className={msg.ok ? 'text-sm' : 'text-sm text-sale'}>
              {msg.text}
            </span>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted">Only the owner can change settings.</p>
      )}
    </form>
  );
}
