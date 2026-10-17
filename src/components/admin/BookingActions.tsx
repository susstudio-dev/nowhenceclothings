'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { BookingStatus } from '@/lib/schemas/bookings';
import { Button, Input } from '@/components/ui';
import { adminFetch } from './api-client';

const toLocal = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

/** A13 admin: resend link, extend deadline, cancel (+ refund), refund. */
export function BookingActions(p: {
  bookingId: string;
  status: BookingStatus;
  balanceDueBy?: string;
  depositPaid: boolean;
  refunded: boolean;
  canWrite: boolean;
  canRefund: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [until, setUntil] = useState(toLocal(p.balanceDueBy ?? new Date(Date.now() + 3 * 86400000).toISOString()));
  const [refundOnCancel, setRefundOnCancel] = useState(false);
  if (!p.canWrite) return null;

  async function act(body: Record<string, unknown>, ok: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await adminFetch<{ sent?: boolean }>(`/api/admin/bookings/${encodeURIComponent(p.bookingId)}`, { method: 'POST', body });
      setMsg({ ok: true, text: res && res.sent === false ? 'Email not sent (no email key configured?).' : ok });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Failed' });
    } finally {
      setBusy(false);
    }
  }

  const open = p.status === 'deposit_paid' || p.status === 'balance_due';
  const extendable = open || p.status === 'expired';
  const cancellable = p.status !== 'cancelled' && p.status !== 'refunded' && p.status !== 'completed';

  return (
    <section className="max-w-2xl space-y-4 border border-line p-4">
      <h2 className="text-lg">Actions</h2>
      {open && (
        <Button variant="secondary" size="sm" loading={busy} onClick={() => void act({ action: 'resend' }, 'Link sent.')}>
          Resend {p.status === 'balance_due' ? 'balance' : 'booking'} link
        </Button>
      )}
      {extendable && (
        <div className="flex flex-wrap items-end gap-2">
          <Input label="Balance deadline" type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} />
          <Button
            variant="secondary"
            size="sm"
            loading={busy}
            onClick={() => void act({ action: 'extend', until: new Date(until).toISOString() }, 'Deadline updated.')}
          >
            Extend deadline
          </Button>
        </div>
      )}
      {cancellable && (
        <div className="flex flex-wrap items-center gap-3">
          {p.depositPaid && p.canRefund && !p.refunded && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={refundOnCancel} onChange={(e) => setRefundOnCancel(e.target.checked)} />
              Refund the deposit
            </label>
          )}
          <Button
            variant="secondary"
            size="sm"
            loading={busy}
            onClick={() =>
              void act({ action: 'cancel', refund: refundOnCancel }, 'Booking cancelled.', `Cancel this booking${refundOnCancel ? ' and refund the deposit' : ''}?`)
            }
          >
            Cancel booking
          </Button>
        </div>
      )}
      {!cancellable && p.status !== 'completed' && p.depositPaid && p.canRefund && !p.refunded && (
        <Button variant="secondary" size="sm" loading={busy} onClick={() => void act({ action: 'refund' }, 'Refund issued.', 'Refund the deposit?')}>
          Refund deposit
        </Button>
      )}
      {msg && (
        <p role="status" className={`text-sm ${msg.ok ? '' : 'text-sale'}`}>
          {msg.text}
        </p>
      )}
    </section>
  );
}
