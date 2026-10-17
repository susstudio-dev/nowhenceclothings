import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('@/lib/guard', () => ({ authorizeAdmin: vi.fn() }));
vi.mock('@/lib/audit', () => ({ audit: vi.fn(async () => {}) }));

import { authorizeAdmin } from '@/lib/guard';
import { audit } from '@/lib/audit';
import { CasConflictError } from '@/lib/storage';
import { adminRoute, errorResponse, HttpError, readBody, sameOrigin } from './api';
import { OrderTransitionError } from './orders';

const admin = { uid: 'u', email: 'm@n.in', name: '', role: 'manager' as const, breakGlass: false, mustChangePassword: false };

describe('adminRoute', () => {
  it('returns the guard response without running the handler', async () => {
    vi.mocked(authorizeAdmin).mockResolvedValueOnce({ ok: false, response: new Response(null, { status: 401 }) });
    const handler = vi.fn();
    const res = await adminRoute({ role: 'owner' }, handler);
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
    expect(authorizeAdmin).toHaveBeenCalledWith('owner', undefined);
  });

  it('runs the handler, audits as the admin, maps errors', async () => {
    vi.mocked(authorizeAdmin).mockResolvedValue({ ok: true, admin });
    const ok = await adminRoute({ cap: 'orders.write' }, async ({ log }) => {
      await log('thing', 't');
      return Response.json({ ok: true });
    });
    expect(ok.status).toBe(200);
    expect(audit).toHaveBeenCalledWith({ actor: 'm@n.in', action: 'thing', target: 't', detail: undefined });
    const bad = await adminRoute({}, async () => {
      throw new OrderTransitionError('paid', 'delivered');
    });
    expect(bad.status).toBe(409);
  });
});

describe('errors + body', () => {
  it('maps known errors', async () => {
    expect(errorResponse(new HttpError(413, 'big')).status).toBe(413);
    expect(errorResponse(new CasConflictError('k', 5)).status).toBe(409);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(errorResponse(new TypeError('boom')).status).toBe(500);
    spy.mockRestore();
  });
  it('readBody validates', async () => {
    const S = z.object({ n: z.number() });
    const req = (b: string) => new Request('http://x/', { method: 'POST', body: b });
    await expect(readBody(req('{"n":1}'), S)).resolves.toEqual({ n: 1 });
    await expect(readBody(req('{"n":"1"}'), S)).rejects.toThrow(/n:/);
    await expect(readBody(req('nope'), S)).rejects.toThrow(/JSON/);
  });
  it('sameOrigin', () => {
    const r = (h: Record<string, string>) => new Request('http://x/', { headers: h });
    expect(sameOrigin(r({ host: 'a.com', origin: 'https://a.com' }))).toBe(true);
    expect(sameOrigin(r({ host: 'a.com', origin: 'https://evil.com' }))).toBe(false);
    expect(sameOrigin(r({ host: 'a.com' }))).toBe(true);
  });
});
