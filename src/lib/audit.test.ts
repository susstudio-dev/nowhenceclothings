import { promises as fs } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { audit, readAudit } from './audit';
import { readUsers, updateUsers } from './users';
import { hashOf, mayWrite, parseMeta, versionToken } from './storage-version-core';

const DATA = path.join(process.cwd(), 'data');
let backup: { audit: boolean; users: string | null };

async function exists(p: string) {
  return fs.stat(p).then(() => true, () => false);
}

// audit/ and users.json are gitignored runtime docs; preserve any local copy.
beforeAll(async () => {
  backup = {
    audit: await exists(path.join(DATA, 'audit')),
    users: await fs.readFile(path.join(DATA, 'users.json'), 'utf8').catch(() => null),
  };
  if (backup.audit) await fs.rename(path.join(DATA, 'audit'), path.join(DATA, 'audit.bak-test'));
  await fs.rm(path.join(DATA, 'users.json'), { force: true });
});
afterAll(async () => {
  await fs.rm(path.join(DATA, 'audit'), { recursive: true, force: true });
  if (backup.audit) await fs.rename(path.join(DATA, 'audit.bak-test'), path.join(DATA, 'audit'));
  await fs.rm(path.join(DATA, 'users.json'), { force: true });
  if (backup.users != null) await fs.writeFile(path.join(DATA, 'users.json'), backup.users);
});

describe('audit', () => {
  it('appends concurrently without losing entries, newest first', async () => {
    await Promise.all(Array.from({ length: 4 }, (_, i) => audit({ actor: 'a@b.co', action: `act-${i}` })));
    await audit({ actor: 'a@b.co', action: 'last', target: 'catalogue.json' });
    const rows = await readAudit(10);
    expect(rows).toHaveLength(5);
    expect(rows[0].action).toBe('last');
  });
});

describe('users store', () => {
  it('reads empty when absent and CAS-updates', async () => {
    expect(await readUsers()).toEqual([]);
    await updateUsers((u) => [
      ...u,
      {
        id: 'u-1', email: 'm@b.co', name: 'M', passwordHash: 'pbkdf2$x', role: 'manager', status: 'active',
        mustChangePassword: false, sessionVersion: 0, createdAt: '', createdBy: '', lastLoginAt: '',
      },
    ]);
    expect((await readUsers())?.[0].role).toBe('manager');
  });
});

describe('storage-version-core', () => {
  it('hashes, compares and parses meta', () => {
    expect(mayWrite('a', { hash: hashOf('a') })).toBe(true);
    expect(mayWrite('a', { hash: hashOf('b') })).toBe(false);
    expect(parseMeta(undefined)).toEqual({ lineage: 'legacy', rev: 0 });
    expect(versionToken({ lineage: 'L', rev: 3 })).toBe('L:3');
  });
});
