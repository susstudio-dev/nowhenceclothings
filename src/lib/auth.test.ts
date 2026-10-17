import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./users', () => ({ readUsers: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));

import { BREAK_GLASS_UID, createSessionToken, verifyCredentials, verifySessionToken, recordAttempt, clearAttempts, SESSION_COOKIE } from './auth';
import { hashPassword } from './password';
import { readUsers } from './users';
import { SessionClaimsSchema } from './session-claims';
import { resolveAdminFromClaims } from './admin-subject';
import { ROLE_CAPABILITIES, roleAtLeast, roleHas } from './roles';
import type { User } from './schemas/users';

const env = { ...process.env };
beforeEach(() => {
  process.env.ADMIN_OWNER_EMAIL = 'Owner@Nowhence.test ';
  process.env.ADMIN_OWNER_INITIAL_PASSWORD = 'owner-pass-123';
  delete process.env.ADMIN_OWNER_PASSWORD_HASH;
  delete process.env.ADMIN_OWNER_TOKEN_EPOCH;
});
afterEach(() => {
  process.env = { ...env };
  vi.mocked(readUsers).mockReset();
});

const user = (over: Partial<User> = {}): User => ({
  id: 'u-1',
  email: 'ed@nowhence.test',
  name: 'Ed',
  passwordHash: '',
  role: 'editor',
  status: 'active',
  mustChangePassword: false,
  sessionVersion: 2,
  createdAt: '',
  createdBy: '',
  lastLoginAt: '',
  ...over,
});

describe('cookie name', () => {
  it('is nowhence_admin', () => expect(SESSION_COOKIE).toBe('nowhence_admin'));
});

describe('verifyCredentials', () => {
  it('accepts the env owner (case/whitespace-insensitive email)', async () => {
    const p = await verifyCredentials('  OWNER@nowhence.test', 'owner-pass-123');
    expect(p).toMatchObject({ uid: BREAK_GLASS_UID, role: 'owner', breakGlass: true });
  });

  it('rejects a wrong owner password', async () => {
    expect(await verifyCredentials('owner@nowhence.test', 'nope')).toBeNull();
  });

  it('accepts the owner via PBKDF2 hash when set', async () => {
    process.env.ADMIN_OWNER_PASSWORD_HASH = await hashPassword('hashed-secret-123');
    expect(await verifyCredentials('owner@nowhence.test', 'hashed-secret-123')).not.toBeNull();
    expect(await verifyCredentials('owner@nowhence.test', 'owner-pass-123')).toBeNull();
  });

  it('accepts a store user with the right password and returns their role', async () => {
    vi.mocked(readUsers).mockResolvedValue([user({ passwordHash: await hashPassword('editor-pass-1'), role: 'manager' })]);
    const p = await verifyCredentials('ed@nowhence.test', 'editor-pass-1');
    expect(p).toMatchObject({ uid: 'u-1', role: 'manager', sessionVersion: 2, breakGlass: false });
  });

  it('rejects disabled users and unreadable stores', async () => {
    vi.mocked(readUsers).mockResolvedValue([user({ passwordHash: await hashPassword('x-pass-123'), status: 'disabled' })]);
    expect(await verifyCredentials('ed@nowhence.test', 'x-pass-123')).toBeNull();
    vi.mocked(readUsers).mockResolvedValue(null);
    expect(await verifyCredentials('ed@nowhence.test', 'x-pass-123')).toBeNull();
  });
});

describe('session tokens', () => {
  it('round-trips claims', async () => {
    const t = await createSessionToken({ uid: 'u-1', email: 'ed@nowhence.test', role: 'editor', sv: 2 });
    expect(await verifySessionToken(t)).toMatchObject({ uid: 'u-1', role: 'editor', sv: 2, brk: false });
  });

  it('rejects tampered tokens', async () => {
    const t = await createSessionToken({ uid: 'u-1', email: 'e', role: 'editor', sv: 0 });
    expect(await verifySessionToken(t.slice(0, -2) + 'xx')).toBeNull();
  });

  it('revokes break-glass tokens when the epoch changes', async () => {
    const t = await createSessionToken({ uid: BREAK_GLASS_UID, email: 'o', role: 'owner', sv: 0, brk: true });
    expect(await verifySessionToken(t)).not.toBeNull();
    process.env.ADMIN_OWNER_TOKEN_EPOCH = 'rotated';
    expect(await verifySessionToken(t)).toBeNull();
  });

  it('claims schema rejects unknown roles', () => {
    expect(SessionClaimsSchema.safeParse({ uid: 'a', email: 'b', role: 'viewer' }).success).toBe(false);
  });
});

describe('resolveAdminFromClaims', () => {
  const claims = { uid: 'u-1', email: 'ed@nowhence.test', role: 'owner' as const, sv: 2, brk: false };

  it('takes the role from the store, not the token', () => {
    expect(resolveAdminFromClaims(claims, user())?.role).toBe('editor');
  });
  it('rejects stale session versions, disabled and missing users', () => {
    expect(resolveAdminFromClaims({ ...claims, sv: 1 }, user())).toBeNull();
    expect(resolveAdminFromClaims(claims, user({ status: 'disabled' }))).toBeNull();
    expect(resolveAdminFromClaims(claims, null)).toBeNull();
  });
  it('admits break-glass as owner without a record', () => {
    expect(resolveAdminFromClaims({ ...claims, brk: true }, null)?.role).toBe('owner');
  });
});

describe('roles', () => {
  it('ranks owner > manager > editor', () => {
    expect(roleAtLeast('owner', 'manager')).toBe(true);
    expect(roleAtLeast('editor', 'manager')).toBe(false);
    expect(roleAtLeast('manager', 'manager')).toBe(true);
  });
  it('only owner manages users and settings; editor cannot touch money', () => {
    expect(roleHas('owner', 'users.manage')).toBe(true);
    expect(roleHas('manager', 'users.manage')).toBe(false);
    expect(roleHas('manager', 'settings.write')).toBe(false);
    for (const cap of ['orders.read', 'orders.write', 'coupons.write', 'content.publish'] as const) {
      expect(roleHas('editor', cap)).toBe(false);
    }
    expect(ROLE_CAPABILITIES.editor.every((c) => roleHas('manager', c))).toBe(true);
  });
});

describe('login rate limit', () => {
  it('blocks after 5 attempts per window', () => {
    clearAttempts('1.2.3.4');
    for (let i = 0; i < 5; i++) expect(recordAttempt('1.2.3.4').allowed).toBe(true);
    expect(recordAttempt('1.2.3.4').allowed).toBe(false);
    clearAttempts('1.2.3.4');
  });
});
