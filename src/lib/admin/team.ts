// Pure team mutations (A7). Owner-only at the route layer; these enforce the
// invariants: unique email, never lose the last active owner, and bump
// sessionVersion on any change that should revoke live sessions.
import type { RoleId, User } from '@/lib/schemas/users';

export class TeamError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'TeamError';
  }
}

const activeOwners = (users: User[]) => users.filter((u) => u.role === 'owner' && u.status === 'active');

function assertOwnerRemains(next: User[], before: User[]) {
  if (activeOwners(before).length > 0 && activeOwners(next).length === 0) {
    throw new TeamError('There must be at least one active owner');
  }
}

export function addUser(users: User[], user: User): User[] {
  if (users.some((u) => u.email === user.email)) throw new TeamError('A user with that email already exists');
  return [...users, user];
}

export function updateUser(
  users: User[],
  id: string,
  patch: { role?: RoleId; status?: 'active' | 'disabled'; name?: string },
): User[] {
  const cur = users.find((u) => u.id === id);
  if (!cur) throw new TeamError('User not found');
  const revokes = (patch.role && patch.role !== cur.role) || (patch.status && patch.status !== cur.status);
  const next = users.map((u) =>
    u.id === id ? { ...u, ...patch, sessionVersion: revokes ? u.sessionVersion + 1 : u.sessionVersion } : u,
  );
  assertOwnerRemains(next, users);
  return next;
}

export function removeUser(users: User[], id: string, actorUid: string): User[] {
  if (id === actorUid) throw new TeamError('You cannot remove yourself');
  if (!users.some((u) => u.id === id)) throw new TeamError('User not found');
  const next = users.filter((u) => u.id !== id);
  assertOwnerRemains(next, users);
  return next;
}

export function setPassword(users: User[], id: string, passwordHash: string, mustChange: boolean): User[] {
  if (!users.some((u) => u.id === id)) throw new TeamError('User not found');
  return users.map((u) =>
    u.id === id ? { ...u, passwordHash, mustChangePassword: mustChange, sessionVersion: u.sessionVersion + 1 } : u,
  );
}

/** Human-friendly temporary password (no ambiguous characters). */
export function tempPassword(len = 14): string {
  const a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(len)), (b) => a[b % a.length]).join('');
}
