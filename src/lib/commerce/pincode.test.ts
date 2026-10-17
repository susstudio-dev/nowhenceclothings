import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPincodeCache, lookupPincode, parsePostalResponse } from './pincode';

const ok = [
  {
    Status: 'Success',
    PostOffice: [
      { Name: 'Koramangala', District: 'BANGALORE', Block: 'Bangalore South', State: 'KARNATAKA' },
      { Name: 'Ejipura', District: 'Bangalore', State: 'Karnataka' },
    ],
  },
];

describe('pincode', () => {
  beforeEach(() => clearPincodeCache());

  it('parses India Post responses', () => {
    expect(parsePostalResponse('560034', ok)).toMatchObject({ city: 'Bangalore', state: 'Karnataka', areas: ['Koramangala', 'Ejipura'] });
    expect(parsePostalResponse('999999', [{ Status: 'Error', PostOffice: null }])).toBeNull();
    expect(parsePostalResponse('1', 'garbage')).toBeNull();
    const andaman = parsePostalResponse('744101', [{ Status: 'Success', PostOffice: [{ District: 'South Andaman', State: 'ANDAMAN AND NICOBAR ISLANDS' }] }]);
    expect(andaman!.state).toBe('Andaman and Nicobar Islands');
  });

  it('caches hits and never throws', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify(ok))) as unknown as typeof fetch;
    expect((await lookupPincode('560034', { fetchImpl: f }))!.state).toBe('Karnataka');
    await lookupPincode('560034', { fetchImpl: f });
    expect(f).toHaveBeenCalledTimes(1);
    const boom = vi.fn(async () => {
      throw new Error('net');
    }) as unknown as typeof fetch;
    expect(await lookupPincode('110001', { fetchImpl: boom })).toBeNull();
    expect(await lookupPincode('012345', { fetchImpl: f })).toBeNull();
  });

  it('times out slow upstreams', async () => {
    const slow = ((_: string, init: RequestInit) =>
      new Promise((_r, rej) => init.signal!.addEventListener('abort', () => rej(new Error('aborted'))))) as unknown as typeof fetch;
    expect(await lookupPincode('400001', { fetchImpl: slow, timeoutMs: 20 })).toBeNull();
  });
});
