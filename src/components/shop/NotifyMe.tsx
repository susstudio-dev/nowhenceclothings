'use client';
import { useState, type FormEvent } from 'react';
import { Button, Input } from '@/components/ui';

/**
 * Back-in-stock / drop notification signup. Posts to the commerce workstream's
 * `/api/notify` endpoint ({ sku, email }) which appends to notify/{sku}.json.
 */
export function NotifyMe({ sku, label = 'Notify me' }: { sku: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [email, setEmail] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState('busy');
    try {
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sku, email }),
      });
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  }

  if (state === 'done') return <p role="status" className="text-sm">We&apos;ll email you when it&apos;s available.</p>;
  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <Input
        type="email"
        required
        autoComplete="email"
        label="Email for notification"
        hideLabel
        placeholder="Email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={state === 'error' ? 'Something went wrong. Try again.' : undefined}
        className="flex-1"
      />
      <Button type="submit" variant="secondary" loading={state === 'busy'}>
        {label}
      </Button>
    </form>
  );
}
