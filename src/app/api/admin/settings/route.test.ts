import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsDoc, SETTINGS_STALE_MESSAGE, isStaleSettingsWrite } from '@/lib/schemas/settings';

let stored: SettingsDoc;

vi.mock('@/lib/guard', () => ({
  authorizeAdmin: vi.fn(async () => ({
    ok: true,
    admin: { uid: 'u', email: 'o@n.in', name: '', role: 'owner', breakGlass: false, mustChangePassword: false },
  })),
}));
vi.mock('@/lib/audit', () => ({ audit: vi.fn(async () => {}) }));
vi.mock('@/lib/content', () => ({ getSettings: vi.fn(async () => stored) }));
vi.mock('@/lib/storage', async (orig) => ({
  ...(await orig<typeof import('@/lib/storage')>()),
  writeJsonCas: vi.fn(async (_k: string, schema: typeof SettingsDoc, mutate: (c: SettingsDoc) => unknown) => {
    stored = schema.parse(await mutate(stored));
    return stored;
  }),
}));

import { PUT } from './route';

const seed = SettingsDoc.parse(JSON.parse(readFileSync('data/settings.json', 'utf8')));
const put = (body: unknown) =>
  PUT(new Request('http://localhost/api/admin/settings', { method: 'PUT', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }));

describe('F13 settings optimistic concurrency', () => {
  beforeEach(() => {
    stored = { ...seed, updatedAt: '2026-01-01T00:00:00.000Z' };
  });

  it('isStaleSettingsWrite compares stored vs sent updatedAt (legacy docs default to "")', () => {
    expect(isStaleSettingsWrite({ updatedAt: 'a' }, 'a')).toBe(false);
    expect(isStaleSettingsWrite({ updatedAt: 'b' }, 'a')).toBe(true);
    expect(isStaleSettingsWrite(null, '')).toBe(false);
    expect(SettingsDoc.parse(JSON.parse(readFileSync('data/settings.json', 'utf8'))).updatedAt).toBe('');
  });

  it('saves a fresh form and stamps a new updatedAt', async () => {
    const res = await put({ ...stored, shipping: { ...stored.shipping, eta: 'Fast' } });
    expect(res.status).toBe(200);
    const { settings } = (await res.json()) as { settings: SettingsDoc };
    expect(settings.shipping.eta).toBe('Fast');
    expect(settings.updatedAt).not.toBe('2026-01-01T00:00:00.000Z');
  });

  it('rejects a stale form with 409', async () => {
    const loaded = { ...stored };
    expect((await put({ ...loaded, shipping: { ...loaded.shipping, eta: 'First' } })).status).toBe(200);
    const res = await put({ ...loaded, shipping: { ...loaded.shipping, eta: 'Second' } });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: SETTINGS_STALE_MESSAGE });
    expect(stored.shipping.eta).toBe('First');
  });
});
