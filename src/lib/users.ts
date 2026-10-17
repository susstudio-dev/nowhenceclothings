import 'server-only';
import { readJsonWithVersion, storageMisconfigured, writeJsonCas } from './storage';
import { USERS_KEY, UsersDoc, findByEmail, type User } from './schemas/users';

export { USERS_KEY, findByEmail };

/**
 * Reads the admin user store. Returns null when the store cannot be read
 * (unparseable, or R2 binding missing) — distinct from an absent document,
 * which is an empty roster. Callers then fall back to break-glass only.
 */
export async function readUsers(): Promise<User[] | null> {
  try {
    const doc = await readJsonWithVersion(USERS_KEY, UsersDoc);
    if (doc == null) return (await storageMisconfigured()) ? null : [];
    return doc.data.users;
  } catch {
    return null;
  }
}

export async function getUserById(id: string): Promise<User | null> {
  const users = await readUsers();
  return users?.find((u) => u.id === id) ?? null;
}

/** CAS-mutate the user list. `mutate` must be pure (it may be retried). */
export async function updateUsers(mutate: (users: User[]) => User[]): Promise<User[]> {
  const doc = await writeJsonCas(USERS_KEY, UsersDoc, (cur) => ({ users: mutate(cur?.users ?? []) }), {
    initial: () => ({ users: [] }),
  });
  return doc.users;
}
