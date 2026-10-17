import { describe, expect, it } from 'vitest';
import type { User } from '@/lib/schemas/users';
import { addUser, removeUser, setPassword, tempPassword, TeamError, updateUser } from './team';

const u = (id: string, role: User['role'], over: Partial<User> = {}): User => ({
  id,
  email: `${id}@n.in`,
  name: id,
  passwordHash: 'h',
  role,
  status: 'active',
  mustChangePassword: false,
  sessionVersion: 0,
  createdAt: '',
  createdBy: '',
  lastLoginAt: '',
  ...over,
});

describe('team', () => {
  const team = [u('own', 'owner'), u('mgr', 'manager')];

  it('addUser rejects duplicate email', () => {
    expect(addUser(team, u('ed', 'editor'))).toHaveLength(3);
    expect(() => addUser(team, u('x', 'editor', { email: 'mgr@n.in' }))).toThrow(TeamError);
  });

  it('role/status changes bump sessionVersion; name does not', () => {
    expect(updateUser(team, 'mgr', { role: 'editor' })[1].sessionVersion).toBe(1);
    expect(updateUser(team, 'mgr', { status: 'disabled' })[1].sessionVersion).toBe(1);
    expect(updateUser(team, 'mgr', { name: 'M' })[1].sessionVersion).toBe(0);
  });

  it('never loses the last active owner', () => {
    expect(() => updateUser(team, 'own', { role: 'manager' })).toThrow(/owner/);
    expect(() => updateUser(team, 'own', { status: 'disabled' })).toThrow(/owner/);
    const two = [...team, u('own2', 'owner')];
    expect(updateUser(two, 'own', { role: 'manager' })[0].role).toBe('manager');
    expect(() => removeUser(team, 'own', 'mgr')).toThrow(/owner/);
  });

  it('cannot remove yourself or unknown users', () => {
    expect(() => removeUser(team, 'own', 'own')).toThrow(/yourself/);
    expect(() => removeUser(team, 'zzz', 'own')).toThrow(/not found/);
    expect(removeUser(team, 'mgr', 'own').map((x) => x.id)).toEqual(['own']);
  });

  it('setPassword flags must-change and revokes sessions', () => {
    const out = setPassword(team, 'mgr', 'new', true)[1];
    expect(out).toMatchObject({ passwordHash: 'new', mustChangePassword: true, sessionVersion: 1 });
  });

  it('tempPassword is long and unambiguous', () => {
    const p = tempPassword();
    expect(p).toHaveLength(14);
    expect(p).not.toMatch(/[0O1lI]/);
  });
});
