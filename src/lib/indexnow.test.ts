import { describe, expect, it, vi } from 'vitest';
import {
  INDEXNOW_ENDPOINT,
  indexNowKeyLocation,
  indexNowPayload,
  indexNowUrls,
  isValidIndexNowKey,
  pingIndexNow,
  resolveIndexNowKey,
} from './indexnow';
import { productPathsToSubmit } from './indexnow-server';
import { DEFAULTS, NOW, catalogue, rawProduct, variantsFor } from './__fixtures__/seo';

const KEY = 'a1b2c3d4e5f6a7b8';

describe('indexnow keys', () => {
  it('validates 8-128 letters, digits and dashes', () => {
    expect(isValidIndexNowKey(KEY)).toBe(true);
    expect(isValidIndexNowKey('short')).toBe(false);
    expect(isValidIndexNowKey('has space in it')).toBe(false);
    expect(isValidIndexNowKey('x'.repeat(129))).toBe(false);
    expect(isValidIndexNowKey('')).toBe(false);
    expect(isValidIndexNowKey(undefined)).toBe(false);
  });

  it('env wins over settings; invalid keys count as none', () => {
    expect(resolveIndexNowKey('settingskey123', 'envkey123456')).toBe('envkey123456');
    expect(resolveIndexNowKey('settingskey123', undefined)).toBe('settingskey123');
    expect(resolveIndexNowKey('', '')).toBeNull();
    expect(resolveIndexNowKey('bad key!', 'tiny')).toBeNull();
    expect(resolveIndexNowKey('settingskey123', 'tiny')).toBe('settingskey123');
  });

  it('serves the key file from the canonical host', () => {
    expect(indexNowKeyLocation(KEY)).toBe(`https://nowhenceclothings.com/${KEY}.txt`);
  });
});

describe('indexnow urls and payload', () => {
  it('absolutises, canonicalises, dedupes and keeps only the canonical host', () => {
    expect(indexNowUrls(['/', '/shop?x=1', '/shop/', 'https://nowhenceclothings.com/about', 'https://evil.example/x'])).toEqual([
      'https://nowhenceclothings.com/',
      'https://nowhenceclothings.com/shop',
      'https://nowhenceclothings.com/about',
    ]);
  });

  it('builds the documented request body', () => {
    expect(indexNowPayload(KEY, ['https://nowhenceclothings.com/'])).toEqual({
      host: 'nowhenceclothings.com',
      key: KEY,
      keyLocation: `https://nowhenceclothings.com/${KEY}.txt`,
      urlList: ['https://nowhenceclothings.com/'],
    });
  });
});

describe('pingIndexNow', () => {
  it('posts JSON to api.indexnow.org', async () => {
    const fetchImpl = vi.fn(async () => ({ status: 202 }));
    expect(await pingIndexNow(['/products/polo'], KEY, fetchImpl)).toBe(202);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, { method: string; body: string }];
    expect(url).toBe(INDEXNOW_ENDPOINT);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body).urlList).toEqual(['https://nowhenceclothings.com/products/polo']);
  });

  it('is skipped without a key or urls, and never throws', async () => {
    const fetchImpl = vi.fn(async () => ({ status: 200 }));
    expect(await pingIndexNow(['/'], null, fetchImpl)).toBeNull();
    expect(await pingIndexNow([], KEY, fetchImpl)).toBeNull();
    expect(await pingIndexNow(['https://other.example/'], KEY, fetchImpl)).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(
      await pingIndexNow(['/'], KEY, async () => {
        throw new Error('offline');
      }),
    ).toBeNull();
  });
});

describe('productPathsToSubmit', () => {
  const cat = catalogue([
    rawProduct(),
    rawProduct({ id: 'p2', slug: 'polo-secret', variants: variantsFor('SEC'), availability: 'coming_soon' }),
    rawProduct({ id: 'p3', slug: 'polo-draft', variants: variantsFor('DFT'), status: 'draft' }),
    rawProduct({ id: 'p4', slug: 'polo-pre', variants: variantsFor('PRE'), availability: 'presale', presale: { enabled: true } }),
  ]);

  it('submits live and presale pieces plus the pages that list them', () => {
    expect(productPathsToSubmit(cat, ['p1', 'p4'], DEFAULTS, NOW)).toEqual(['/', '/shop', '/products/polo-black', '/products/polo-pre']);
  });

  it('never submits coming-soon or draft slugs (secrecy)', () => {
    expect(productPathsToSubmit(cat, ['p2', 'p3', 'missing'], DEFAULTS, NOW)).toEqual(['/', '/shop']);
  });
});
