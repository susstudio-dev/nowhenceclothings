'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Coupon } from '@/lib/schemas/coupons';
import { formatPaise } from '@/lib/money';
import { Button, Input, Select } from '@/components/ui';
import { adminFetch, toPaise, toRupees } from './api-client';
import { useMsgToast } from './useMsgToast';

const blank = (): Coupon => ({
  id: `cpn-${Date.now().toString(36)}`,
  code: '',
  type: 'percent',
  value: 10,
  description: '',
  active: true,
  minOrder: 0,
  usedCount: 0,
  createdAt: new Date().toISOString(),
});

function describe(c: Coupon): string {
  if (c.type === 'percent') return `${c.value}% off${c.maxDiscount ? ` (max ${formatPaise(c.maxDiscount)})` : ''}`;
  if (c.type === 'flat') return `${formatPaise(c.value)} off`;
  return 'Free shipping';
}

const toLocal = (iso?: string) => (iso ? iso.slice(0, 16) : '');
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : undefined);

export function CouponsEditor({ coupons }: { coupons: Coupon[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useMsgToast(msg);
  const [busy, setBusy] = useState(false);

  async function save(c: Coupon) {
    setBusy(true);
    setMsg(null);
    try {
      await adminFetch('/api/admin/coupons', { method: 'PUT', body: { coupon: c } });
      setEditing(null);
      setMsg({ ok: true, text: `Saved ${c.code}` });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: Coupon) {
    if (!window.confirm(`Delete coupon ${c.code}?`)) return;
    try {
      await adminFetch(`/api/admin/coupons/${encodeURIComponent(c.id)}`, { method: 'DELETE' });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Delete failed' });
    }
  }

  const e = editing;
  const patch = (p: Partial<Coupon>) => setEditing((cur) => (cur ? ({ ...cur, ...p } as Coupon) : cur));

  return (
    <div className="space-y-6">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted">
            <th className="py-1">Code</th>
            <th>Discount</th>
            <th>Min order</th>
            <th>Used</th>
            <th>Window</th>
            <th>Active</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {coupons.map((c) => (
            <tr key={c.id} className="border-t border-line">
              <td className="py-1 font-mono">{c.code}</td>
              <td>{describe(c)}</td>
              <td>{c.minOrder ? formatPaise(c.minOrder) : '—'}</td>
              <td>
                {c.usedCount}
                {c.usageLimit ? ` / ${c.usageLimit}` : ''}
              </td>
              <td className="text-xs">
                {c.startsAt?.slice(0, 10) ?? '…'} → {c.expiresAt?.slice(0, 10) ?? '…'}
              </td>
              <td>{c.active ? 'Yes' : 'No'}</td>
              <td className="space-x-3 text-right">
                <button type="button" className="underline" onClick={() => setEditing(c)}>
                  Edit
                </button>
                <button type="button" className="text-sale underline" onClick={() => remove(c)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!e && (
        <Button variant="secondary" onClick={() => setEditing(blank())}>
          New coupon
        </Button>
      )}
      {e && (
        <form
          className="grid gap-4 border border-line p-4 md:grid-cols-3"
          onSubmit={(ev) => {
            ev.preventDefault();
            void save(e);
          }}
        >
          <Input label="Code" required value={e.code} onChange={(x) => patch({ code: x.target.value.toUpperCase() })} />
          <Select
            label="Type"
            value={e.type}
            options={[
              { value: 'percent', label: 'Percent off' },
              { value: 'flat', label: 'Flat amount off' },
              { value: 'free_shipping', label: 'Free shipping' },
            ]}
            onChange={(x) => {
              const t = x.target.value as Coupon['type'];
              const { value: _v, maxDiscount: _m, ...rest } = e as Coupon & { value?: number; maxDiscount?: number };
              setEditing(
                t === 'percent'
                  ? { ...rest, type: 'percent', value: 10 }
                  : t === 'flat'
                    ? { ...rest, type: 'flat', value: 50000 }
                    : { ...rest, type: 'free_shipping' },
              );
            }}
          />
          {e.type === 'percent' && (
            <>
              <Input label="Percent" type="number" min={1} max={100} value={e.value} onChange={(x) => patch({ value: Math.trunc(Number(x.target.value)) })} />
              <Input
                label="Max discount (₹, optional)"
                type="number"
                min={0}
                value={toRupees(e.maxDiscount)}
                onChange={(x) => patch({ maxDiscount: toPaise(x.target.value) } as Partial<Coupon>)}
              />
            </>
          )}
          {e.type === 'flat' && (
            <Input label="Amount (₹)" type="number" min={0} value={toRupees(e.value)} onChange={(x) => patch({ value: toPaise(x.target.value) ?? 0 })} />
          )}
          <Input label="Minimum order (₹)" type="number" min={0} value={toRupees(e.minOrder)} onChange={(x) => patch({ minOrder: toPaise(x.target.value) ?? 0 })} />
          <Input
            label="Usage limit (blank = unlimited)"
            type="number"
            min={1}
            value={e.usageLimit ?? ''}
            onChange={(x) => patch({ usageLimit: x.target.value ? Math.trunc(Number(x.target.value)) : undefined })}
          />
          <Input label="Starts" type="datetime-local" value={toLocal(e.startsAt)} onChange={(x) => patch({ startsAt: fromLocal(x.target.value) })} />
          <Input label="Expires" type="datetime-local" value={toLocal(e.expiresAt)} onChange={(x) => patch({ expiresAt: fromLocal(x.target.value) })} />
          <Input label="Description" value={e.description} onChange={(x) => patch({ description: x.target.value })} />
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={e.active} onChange={(x) => patch({ active: x.target.checked })} /> Active
          </label>
          <div className="flex gap-3 md:col-span-3">
            <Button type="submit" loading={busy}>
              Save coupon
            </Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
      {msg && (
        <p role="status" className={msg.ok ? 'text-sm' : 'text-sm text-sale'}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

export function SalePricing({ products }: { products: { id: string; title: string; price: number; compareAtPrice?: number }[] }) {
  const router = useRouter();
  const [ids, setIds] = useState<string[]>([]);
  const [pct, setPct] = useState('20');
  const [ends, setEnds] = useState('');
  const [msg, setMsg] = useState('');

  async function apply(percentOff: number) {
    setMsg('');
    try {
      await adminFetch('/api/admin/sale', { body: { productIds: ids, percentOff, ...(ends ? { saleEndsAt: new Date(ends).toISOString() } : {}) } });
      setMsg(percentOff ? 'Sale applied' : 'Sale ended');
      setIds([]);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed');
    }
  }

  return (
    <div className="space-y-3">
      <ul className="grid gap-1 text-sm md:grid-cols-2">
        {products.map((p) => (
          <li key={p.id}>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={ids.includes(p.id)}
                onChange={(e) => setIds(e.target.checked ? [...ids, p.id] : ids.filter((x) => x !== p.id))}
              />
              {p.title} — {formatPaise(p.price)}
              {p.compareAtPrice && p.compareAtPrice > p.price && <s className="text-muted">{formatPaise(p.compareAtPrice)}</s>}
            </label>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-3">
        <Input label="Percent off" type="number" min={1} max={90} value={pct} onChange={(e) => setPct(e.target.value)} />
        <Input label="Ends (optional)" type="datetime-local" value={ends} onChange={(e) => setEnds(e.target.value)} />
        <Button disabled={!ids.length} onClick={() => apply(Number(pct) || 0)}>
          Start sale
        </Button>
        <Button variant="secondary" disabled={!ids.length} onClick={() => apply(0)}>
          End sale
        </Button>
        {msg && <span role="status" className="text-sm">{msg}</span>}
      </div>
    </div>
  );
}
