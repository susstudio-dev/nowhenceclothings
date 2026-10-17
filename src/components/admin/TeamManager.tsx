'use client';

import { useState } from 'react';
import { ROLE_IDS, type RoleId, type User } from '@/lib/schemas/users';
import { ROLE_LABELS } from '@/lib/roles';
import { Button, Input, Select } from '@/components/ui';
import { adminFetch } from './api-client';
import { useMsgToast } from './useMsgToast';

type PublicUser = Omit<User, 'passwordHash'>;
const roleOptions = ROLE_IDS.map((r) => ({ value: r, label: ROLE_LABELS[r] }));

export function TeamManager({ initial, selfId }: { initial: PublicUser[]; selfId: string }) {
  const [users, setUsers] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useMsgToast(msg);
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);

  async function call(path: string, method: string, body?: unknown, email?: string) {
    setMsg(null);
    try {
      const res = await adminFetch<{ users: PublicUser[]; tempPassword?: string }>(path, { method, body });
      setUsers(res.users);
      if (res.tempPassword && email) setSecret({ email, password: res.tempPassword });
      setMsg({ ok: true, text: 'Saved' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Failed' });
    }
  }

  return (
    <div className="space-y-8">
      {secret && (
        <div role="alert" className="border border-accent p-4 text-sm">
          Temporary password for <b>{secret.email}</b>: <code className="select-all font-mono">{secret.password}</code>
          <p className="text-xs text-muted">Shown once. Share it privately; they must change it on first sign-in.</p>
          <button type="button" className="mt-2 underline" onClick={() => setSecret(null)}>
            Done
          </button>
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted">
            <th className="py-1">Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Last sign-in</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t border-line">
              <td className="py-1">{u.name || '—'}</td>
              <td>{u.email}</td>
              <td>
                <select
                  aria-label={`Role for ${u.email}`}
                  value={u.role}
                  disabled={u.id === selfId}
                  onChange={(e) => call(`/api/admin/users/${u.id}`, 'PATCH', { role: e.target.value as RoleId })}
                  className="border border-line px-2 py-1"
                >
                  {roleOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </td>
              <td>{u.status}</td>
              <td className="text-xs">{u.lastLoginAt ? u.lastLoginAt.slice(0, 16).replace('T', ' ') : 'never'}</td>
              <td className="space-x-3 text-right">
                {u.id !== selfId && (
                  <>
                    <button
                      type="button"
                      className="underline"
                      onClick={() =>
                        call(`/api/admin/users/${u.id}`, 'PATCH', { status: u.status === 'active' ? 'disabled' : 'active' })
                      }
                    >
                      {u.status === 'active' ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      type="button"
                      className="underline"
                      onClick={() => call(`/api/admin/users/${u.id}`, 'PATCH', { resetPassword: true }, u.email)}
                    >
                      Reset password
                    </button>
                    <button
                      type="button"
                      className="text-sale underline"
                      onClick={() => window.confirm(`Remove ${u.email}?`) && call(`/api/admin/users/${u.id}`, 'DELETE')}
                    >
                      Remove
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form
        className="grid items-end gap-3 md:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const email = String(fd.get('email'));
          void call('/api/admin/users', 'POST', { email, name: fd.get('name'), role: fd.get('role') }, email);
          e.currentTarget.reset();
        }}
      >
        <Input label="Email" name="email" type="email" required />
        <Input label="Name" name="name" />
        <Select label="Role" name="role" defaultValue="editor" options={roleOptions} />
        <Button type="submit">Invite</Button>
      </form>
      {msg && (
        <p role="status" className={msg.ok ? 'text-sm' : 'text-sm text-sale'}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

export function ChangePasswordForm() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      className="max-w-sm space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        if (fd.get('next') !== fd.get('confirm')) return setMsg({ ok: false, text: 'Passwords do not match' });
        try {
          await adminFetch('/api/admin/auth/password', { body: { current: fd.get('current'), next: fd.get('next') } });
          form.reset();
          setMsg({ ok: true, text: 'Password changed' });
        } catch (err) {
          setMsg({ ok: false, text: err instanceof Error ? err.message : 'Failed' });
        }
      }}
    >
      <Input label="Current password" name="current" type="password" autoComplete="current-password" required />
      <Input label="New password" name="next" type="password" minLength={10} autoComplete="new-password" required />
      <Input label="Confirm new password" name="confirm" type="password" autoComplete="new-password" required />
      <Button type="submit">Change password</Button>
      {msg && (
        <p role="status" className={msg.ok ? 'text-sm' : 'text-sm text-sale'}>
          {msg.text}
        </p>
      )}
    </form>
  );
}
