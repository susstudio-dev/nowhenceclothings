'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { OrderStatus, Tracking } from '@/lib/schemas/order';
import { Button, Input, Select } from '@/components/ui';
import { adminFetch, toPaise } from './api-client';
import { ORDER_STATUS_LABELS } from '@/lib/admin/orders';
import { useMsgToast } from './useMsgToast';

const LABEL = ORDER_STATUS_LABELS;

export function OrderActions({
  orderId,
  status,
  next,
  tracking,
  notes,
  total,
  canRefund,
}: {
  orderId: string;
  status: OrderStatus;
  next: readonly OrderStatus[];
  tracking?: Tracking;
  notes: string;
  total: number;
  canRefund: boolean;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useMsgToast(msg);
  const [busy, setBusy] = useState(false);
  const [carrier, setCarrier] = useState(tracking?.carrier ?? '');
  const [number, setNumber] = useState(tracking?.number ?? '');
  const [url, setUrl] = useState(tracking?.url ?? '');

  async function send(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    setMsg(null);
    try {
      await adminFetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, { method: 'PATCH', body });
      setMsg({ ok: true, text: ok });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Failed' });
    } finally {
      setBusy(false);
    }
  }

  const trackingBody = () =>
    carrier && number ? { carrier, number, ...(url ? { url } : {}) } : undefined;

  return (
    <div className="space-y-6">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const to = String(fd.get('status') || '');
          if (!to) return;
          const t = trackingBody();
          void send(
            { status: to, note: String(fd.get('note') || '') || undefined, ...(t ? { tracking: t } : {}) },
            `Marked ${LABEL[to as OrderStatus]}`,
          );
        }}
      >
        <h2 className="text-[11px] font-medium uppercase tracking-label">Status</h2>
        {next.filter((s) => s !== 'refunded').length === 0 ? (
          <p className="text-sm text-muted">No further status changes from {LABEL[status]}.</p>
        ) : (
          <>
            <Select
              label="Move to"
              name="status"
              placeholder="Choose…"
              options={next.filter((s) => s !== 'refunded').map((s) => ({ value: s, label: LABEL[s] }))}
            />
            <Input label="History note (optional)" name="note" maxLength={500} />
            <Button type="submit" loading={busy}>
              Update status
            </Button>
          </>
        )}
      </form>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send({ tracking: trackingBody() ?? null }, 'Tracking saved');
        }}
      >
        <h2 className="text-[11px] font-medium uppercase tracking-label">Tracking</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <Input label="Carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} />
          <Input label="Tracking number" value={number} onChange={(e) => setNumber(e.target.value)} />
          <Input label="Tracking URL" type="url" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <Button type="submit" variant="secondary" loading={busy}>
          Save tracking
        </Button>
      </form>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          void send({ notes: String(fd.get('notes') ?? '') }, 'Notes saved');
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          Internal notes
          <textarea name="notes" defaultValue={notes} rows={3} className="border border-line bg-paper px-3 py-2 focus:border-ink focus:outline-none" />
        </label>
        <Button type="submit" variant="secondary" loading={busy}>
          Save notes
        </Button>
      </form>

      {canRefund && next.includes('refunded') && (
        <form
          className="space-y-3 border border-sale/40 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const amount = toPaise(String(fd.get('amount') ?? ''));
            if (!amount) return setMsg({ ok: false, text: 'Enter a refund amount' });
            if (!window.confirm('Mark this order refunded? Issue the refund in Razorpay first.')) return;
            void send(
              {
                refund: {
                  amount,
                  reason: String(fd.get('reason') || ''),
                  razorpayRefundId: String(fd.get('rfnd') || '') || undefined,
                },
              },
              'Marked refunded',
            );
          }}
        >
          <h2 className="text-[11px] font-medium uppercase tracking-label">Mark refunded</h2>
          <p className="text-xs text-muted">Issue the refund in the Razorpay dashboard, then record it here.</p>
          <div className="grid gap-3 md:grid-cols-3">
            <Input label="Amount (₹)" name="amount" type="number" min={1} max={total / 100} step="0.01" defaultValue={total / 100} />
            <Input label="Razorpay refund id" name="rfnd" />
            <Input label="Reason" name="reason" />
          </div>
          <Button type="submit" variant="secondary" loading={busy}>
            Mark refunded
          </Button>
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
