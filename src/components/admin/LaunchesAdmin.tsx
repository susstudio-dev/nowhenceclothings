'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PresaleConfig } from '@/lib/schemas/launches';
import { Button } from '@/components/ui';
import { adminFetch } from './api-client';
import { PresaleFields } from './AvailabilityEditor';

export function LaunchRowActions({ productId, canEmail, pending }: { productId: string; canEmail: boolean; pending: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  async function email() {
    if (!confirm(`Email ${pending} people on this list? This is sent once per launch.`)) return;
    setBusy(true);
    setMsg('');
    try {
      const r = await adminFetch<{ sent: number; failed: number }>('/api/admin/launches/email', { method: 'POST', body: { productId } });
      setMsg(`Sent ${r.sent}${r.failed ? `, ${r.failed} failed` : ''}`);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a className="underline" href={`/api/admin/launches/notify?productId=${encodeURIComponent(productId)}`}>
        CSV
      </a>
      <Button size="sm" variant="secondary" loading={busy} disabled={!canEmail || !pending} onClick={() => void email()}>
        Email the list
      </Button>
      {msg && <span role="status" className="text-xs">{msg}</span>}
    </div>
  );
}

export function DropPresaleEditor({ dropId, name, initial }: { dropId: string; name: string; initial: PresaleConfig }) {
  const [value, setValue] = useState<PresaleConfig>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  async function save() {
    setBusy(true);
    setMsg('');
    try {
      await adminFetch(`/api/admin/drops/${encodeURIComponent(dropId)}/presale`, { method: 'PUT', body: value });
      setMsg('Saved');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="border border-line p-4">
      <summary className="cursor-pointer text-sm font-medium">
        {name} {initial.enabled ? '· presale on' : ''}
      </summary>
      <div className="mt-4 space-y-4">
        <PresaleFields value={value} onChange={setValue} />
        <div className="flex items-center gap-3">
          <Button size="sm" loading={busy} onClick={() => void save()}>
            Save drop presale
          </Button>
          {msg && <span role="status" className="text-sm">{msg}</span>}
        </div>
      </div>
    </details>
  );
}
