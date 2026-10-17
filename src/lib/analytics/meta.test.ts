import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_META_PIXEL_ID,
  _resetPending,
  _resetSent,
  addToCartParams,
  balanceEventId,
  checkoutParams,
  contentId,
  flushPending,
  isPaidStatus,
  isTrackedPath,
  normalisePixelId,
  paiseToRupees,
  pixelBootstrap,
  pixelNoscriptSrc,
  sentKey,
  track,
  trackOnce,
  viewContentParams,
} from './meta';

type Win = { location: { pathname: string }; fbq?: (...a: unknown[]) => void; sessionStorage: Storage };

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

let win: Win;
function installWindow(pathname = '/', withFbq = true) {
  win = { location: { pathname }, sessionStorage: memoryStorage(), ...(withFbq ? { fbq: vi.fn() } : {}) };
  vi.stubGlobal('window', win);
  return win;
}

beforeEach(() => {
  _resetPending();
  _resetSent();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pixel id + base code', () => {
  it('defaults to the owner pixel', () => {
    expect(DEFAULT_META_PIXEL_ID).toBe('1574364723928175');
  });

  it('normalises ids and refuses anything that is not digits', () => {
    expect(normalisePixelId(' 1574364723928175 ')).toBe('1574364723928175');
    expect(normalisePixelId('')).toBe('');
    expect(normalisePixelId("1'); alert(1); ('")).toBe('');
    expect(normalisePixelId('12ab')).toBe('');
    expect(normalisePixelId(undefined)).toBe('');
    expect(normalisePixelId(1574364723928175)).toBe('');
  });

  it('builds the standard bootstrap with init + PageView, single-quoted', () => {
    const code = pixelBootstrap('1574364723928175');
    expect(code).toContain("fbq('init','1574364723928175')");
    expect(code).toContain("fbq('track','PageView')");
    expect(code).toContain('https://connect.facebook.net/en_US/fbevents.js');
    expect(code).not.toMatch(/[<>&"]/); // safe to inline / serialise
    expect(pixelBootstrap('nope')).toBe('');
    expect(pixelBootstrap('')).toBe('');
  });

  it('noscript beacon url', () => {
    expect(pixelNoscriptSrc('1574364723928175')).toBe('https://www.facebook.com/tr?id=1574364723928175&ev=PageView&noscript=1');
  });
});

describe('admin path exclusion', () => {
  it('tracks storefront paths only', () => {
    for (const p of ['/', '/products/tee', '/checkout', '/checkout/confirmation', '/book/x', '/pay/t', '/administrator', '/adminfoo']) {
      expect(isTrackedPath(p)).toBe(true);
    }
    for (const p of ['/admin', '/admin/', '/admin/login', '/admin/orders/1']) expect(isTrackedPath(p)).toBe(false);
    expect(isTrackedPath(null)).toBe(true);
    expect(isTrackedPath(undefined)).toBe(true);
  });
});

describe('value + ids', () => {
  it('converts paise to rupees as a number', () => {
    expect(paiseToRupees(249900)).toBe(2499);
    expect(paiseToRupees(99950)).toBe(999.5);
    expect(paiseToRupees(1)).toBe(0.01);
    expect(paiseToRupees(0)).toBe(0);
    expect(paiseToRupees(Number.NaN)).toBe(0);
  });

  it('uses the SKU when known, else the product id', () => {
    expect(contentId({ sku: 'NW-TEE-BLK-M', productId: 'p1' })).toBe('NW-TEE-BLK-M');
    expect(contentId({ productId: 'p1' })).toBe('p1');
    expect(contentId({})).toBeUndefined();
  });
});

describe('payload shapes', () => {
  it('ViewContent', () => {
    expect(viewContentParams({ productId: 'p1', title: 'Boxy Tee', price: 249900 })).toEqual({
      content_ids: ['p1'],
      content_name: 'Boxy Tee',
      content_type: 'product',
      value: 2499,
      currency: 'INR',
    });
  });

  it('AddToCart values the added quantity', () => {
    expect(addToCartParams({ sku: 'S1', productId: 'p1', title: 'Boxy Tee', qty: 2, unitPrice: 249900 })).toEqual({
      content_ids: ['S1'],
      content_name: 'Boxy Tee',
      content_type: 'product',
      contents: [{ id: 'S1', quantity: 2 }],
      num_items: 2,
      value: 4998,
      currency: 'INR',
    });
    // No price snapshot -> no value/currency rather than a wrong 0.
    const p = addToCartParams({ sku: 'S1', qty: 1 });
    expect(p).not.toHaveProperty('value');
    expect(p).not.toHaveProperty('currency');
    expect(p).not.toHaveProperty('content_name');
  });

  it('InitiateCheckout / Purchase', () => {
    expect(checkoutParams([{ sku: 'A', qty: 1 }, { sku: 'B', qty: 2 }, { sku: 'A', qty: 1 }], 1234500)).toEqual({
      content_ids: ['A', 'B'],
      content_type: 'product',
      contents: [
        { id: 'A', quantity: 1 },
        { id: 'B', quantity: 2 },
        { id: 'A', quantity: 1 },
      ],
      num_items: 4,
      value: 12345,
      currency: 'INR',
    });
    expect(checkoutParams([{ productId: 'p1', qty: 1 }], 99900)).toMatchObject({ content_ids: ['p1'], num_items: 1, value: 999 });
    expect(checkoutParams([{ qty: 1 }])).toEqual({ content_ids: [], content_type: 'product', contents: [], num_items: 0 });
  });

  it('balance Purchase gets its own eventID', () => {
    expect(balanceEventId('NWB-261017-AB12')).toBe('NWB-261017-AB12-balance');
    expect(balanceEventId('X')).not.toBe('X');
  });

  it('only server-confirmed, kept payments count as paid', () => {
    for (const s of ['paid', 'packed', 'shipped', 'delivered', 'exchange_requested']) expect(isPaidStatus(s)).toBe(true);
    for (const s of ['pending_payment', 'cancelled', 'refunded', '', undefined]) expect(isPaidStatus(s)).toBe(false);
  });
});

describe('track()', () => {
  it('is a no-op on the server (no window)', () => {
    expect(typeof (globalThis as { window?: unknown }).window).toBe('undefined');
    expect(track('PageView')).toBe(false);
    expect(trackOnce('N1', 'Purchase')).toBe(false);
    expect(flushPending()).toBe(0);
  });

  it('is a no-op (and does not throw) when fbq is absent', () => {
    installWindow('/', false);
    expect(() => track('ViewContent', viewContentParams({ productId: 'p', title: 't', price: 100 }))).not.toThrow();
    expect(track('PageView')).toBe(false);
  });

  it('sends standard events with params and eventID', () => {
    const w = installWindow('/products/tee');
    expect(track('AddToCart', { content_ids: ['S1'], value: 1, currency: 'INR' })).toBe(true);
    expect(w.fbq).toHaveBeenCalledWith('track', 'AddToCart', { content_ids: ['S1'], value: 1, currency: 'INR' });
    track('Purchase', { value: 2 }, { eventID: 'NWH-1' });
    expect(w.fbq).toHaveBeenLastCalledWith('track', 'Purchase', { value: 2 }, { eventID: 'NWH-1' });
    track('PageView');
    expect(w.fbq).toHaveBeenLastCalledWith('track', 'PageView');
  });

  it('never sends from /admin', () => {
    const w = installWindow('/admin/orders');
    expect(track('PageView')).toBe(false);
    expect(trackOnce('N1', 'Purchase', { value: 1 })).toBe(false);
    expect(w.fbq).not.toHaveBeenCalled();
  });

  it('swallows fbq errors', () => {
    const w = installWindow('/');
    w.fbq = () => {
      throw new Error('blocked');
    };
    expect(() => track('PageView')).not.toThrow();
  });

  it('queues events fired before the bootstrap and flushes them once fbq exists', () => {
    const w = installWindow('/products/tee', false);
    track('ViewContent', { content_ids: ['p1'] });
    const fbq = vi.fn();
    w.fbq = fbq;
    expect(flushPending()).toBe(1);
    expect(fbq).toHaveBeenCalledWith('track', 'ViewContent', { content_ids: ['p1'] });
    expect(flushPending()).toBe(0);
  });

  it('bounds the pre-bootstrap queue', () => {
    const w = installWindow('/', false);
    for (let i = 0; i < 100; i++) track('PageView');
    w.fbq = vi.fn();
    expect(flushPending()).toBe(20);
  });
});

describe('trackOnce() dedup', () => {
  it('fires once per key per session (confirmation reloads do not double count)', () => {
    const w = installWindow('/checkout/confirmation');
    expect(trackOnce('NWH-261017-AB12', 'Purchase', { value: 10 }, { eventID: 'NWH-261017-AB12' })).toBe(true);
    expect(trackOnce('NWH-261017-AB12', 'Purchase', { value: 10 }, { eventID: 'NWH-261017-AB12' })).toBe(false);
    expect(w.fbq).toHaveBeenCalledTimes(1);
    expect(w.sessionStorage.getItem(sentKey('Purchase', 'NWH-261017-AB12'))).toBe('1');

    // A "reload": module memory is fresh, sessionStorage survives.
    _resetSent();
    expect(trackOnce('NWH-261017-AB12', 'Purchase', { value: 10 })).toBe(false);
    expect(w.fbq).toHaveBeenCalledTimes(1);

    // Another order still fires.
    expect(trackOnce('NWH-261017-ZZ99', 'Purchase', { value: 10 })).toBe(true);
    expect(w.fbq).toHaveBeenCalledTimes(2);
  });

  it('falls back to memory when sessionStorage is blocked', () => {
    const w = installWindow('/');
    w.sessionStorage = {
      ...memoryStorage(),
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(trackOnce('K', 'Purchase')).toBe(true);
    expect(trackOnce('K', 'Purchase')).toBe(false);
    expect(w.fbq).toHaveBeenCalledTimes(1);
  });

  it('ignores an empty key', () => {
    installWindow('/');
    expect(trackOnce('', 'Purchase')).toBe(false);
  });
});
