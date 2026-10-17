import { describe, expect, it } from 'vitest';
import { decodeInvoiceParam, invoiceToken, verifyInvoiceToken } from './access';

const KEY = 'a-test-secret-of-enough-length';

describe('invoice access tokens', () => {
  it('signs and verifies per document', async () => {
    const t = (await invoiceToken('NWH/25-26/0001', KEY))!;
    expect(t).toHaveLength(32);
    expect(await verifyInvoiceToken('NWH/25-26/0001', t, KEY)).toBe(true);
    expect(await verifyInvoiceToken('NWH/25-26/0002', t, KEY)).toBe(false);
    expect(await verifyInvoiceToken('NWH/25-26/0001', t.slice(1), KEY)).toBe(false);
  });

  it('refuses without a secret', async () => {
    expect(await invoiceToken('x', null)).toBeNull();
    expect(await verifyInvoiceToken('x', 'y', null)).toBe(false);
  });

  it('decodes path params', () => {
    expect(decodeInvoiceParam('NWH~CN~25-26~0003')).toBe('NWH/CN/25-26/0003');
  });
});
