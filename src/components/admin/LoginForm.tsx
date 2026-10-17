'use client';

import { useState } from 'react';
import { Button, Input } from '@/components/ui';

export function LoginForm() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; mustChangePassword?: boolean };
      if (!res.ok) throw new Error(data.error ?? 'Sign in failed');
      window.location.href = data.mustChangePassword ? '/admin/account?first=1' : '/admin';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Input label="Email" name="email" type="email" autoComplete="username" required />
      <Input label="Password" name="password" type="password" autoComplete="current-password" required />
      {error && (
        <p role="alert" className="text-sm text-sale">
          {error}
        </p>
      )}
      <Button type="submit" fullWidth loading={busy}>
        Sign in
      </Button>
    </form>
  );
}

export function LogoutButton() {
  return (
    <button
      type="button"
      className="text-sm underline"
      onClick={async () => {
        await fetch('/api/admin/auth/logout', { method: 'POST' });
        window.location.href = '/admin/login';
      }}
    >
      Sign out
    </button>
  );
}
