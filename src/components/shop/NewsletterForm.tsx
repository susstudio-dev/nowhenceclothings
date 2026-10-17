'use client';
import { useState, type FormEvent } from 'react';
import { Button, Input } from '@/components/ui';

/** Newsletter signup (S1). Posts { email, source } to the commerce workstream's `/api/newsletter`. */
export function NewsletterForm({ source = 'home' }: { source?: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState('busy');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, source }),
      });
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  }

  if (state === 'done') return <p role="status">You&apos;re on the list.</p>;
  return (
    <form onSubmit={submit} className="mx-auto flex max-w-md flex-col gap-2 sm:flex-row sm:items-end">
      <Input
        type="email"
        required
        autoComplete="email"
        label="Email address"
        hideLabel
        placeholder="Email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={state === 'error' ? 'Something went wrong. Try again.' : undefined}
        className="flex-1"
      />
      <Button type="submit" loading={state === 'busy'}>
        Sign up
      </Button>
    </form>
  );
}
