'use client';
import { useState, type FormEvent } from 'react';
import { Button, Input } from '@/components/ui';

export const presaleCodeKey = (productId: string) => `nwh-presale-code:${productId}`;

/** A11 access-code gate. The server checks the code here and again at checkout. */
export function PresaleAccessGate({ productId, onUnlocked }: { productId: string; onUnlocked: () => void }) {
  const [code, setCode] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState('busy');
    try {
      const res = await fetch('/api/presale/access', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId, code }),
      });
      if (!res.ok) return setState('error');
      try {
        sessionStorage.setItem(presaleCodeKey(productId), code.trim());
      } catch {
        /* storage blocked: checkout asks again */
      }
      setState('idle');
      onUnlocked();
    } catch {
      setState('error');
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <Input
        label="Pre-order access code"
        required
        autoComplete="off"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        error={state === 'error' ? 'That code is not valid.' : undefined}
        className="flex-1"
      />
      <Button type="submit" variant="secondary" loading={state === 'busy'}>
        Unlock
      </Button>
    </form>
  );
}

/** Any presale access code saved in this tab (sent with checkout). */
export function storedPresaleCode(): string | undefined {
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k?.startsWith('nwh-presale-code:')) return sessionStorage.getItem(k) ?? undefined;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}
