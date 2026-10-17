'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { adminFetch } from './api-client';
import { useMsgToast } from './useMsgToast';

/** F8: retry the stock decrement for a paid order missing stockCommittedAt. */
export function CommitStockButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useMsgToast(msg);
  return (
    <div className="space-y-2 border border-sale p-4 text-sm">
      <p className="font-medium text-sale">Stock was not deducted for this paid order.</p>
      <p className="text-muted">Payment succeeded but the inventory update did not finish. Commit it now.</p>
      <Button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMsg(null);
          try {
            await adminFetch(`/api/admin/orders/${encodeURIComponent(orderId)}/commit-stock`, { method: 'POST' });
            setMsg({ ok: true, text: 'Stock committed.' });
            router.refresh();
          } catch (e) {
            setMsg({ ok: false, text: e instanceof Error ? e.message : 'Failed' });
          } finally {
            setBusy(false);
          }
        }}
      >
        Commit stock
      </Button>
      {msg && (
        <p role="status" className={msg.ok ? 'text-ink' : 'text-sale'}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
