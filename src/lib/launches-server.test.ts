import { promises as fs } from 'node:fs';
import path from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { readJson } from './storage';
import { PresaleLedgerDoc } from './schemas/launches';
import { CatalogueDoc, type Product } from './schemas/catalogue';
import { SettingsDoc } from './schemas/settings';
import { projectCatalogue, productsFor, releasePresaleUnits, reservePresaleUnits } from './launches-server';
import { buildQuote, type QuoteContext } from './commerce/quote';
import { CheckoutError, assertCheckoutable, presaleGate } from './commerce/checkout';
import { inventoryLines } from './commerce/order-lines';

const DIR = '__test__/presale';
const KEY = `${DIR}/ledger.json`;
const DATA = path.join(process.env.NOWHENCE_DATA_DIR ?? path.join(process.cwd(), 'data'));
async function cleanup() {
  await fs.rm(path.join(DATA, DIR), { recursive: true, force: true });
  await fs.rm(path.join(DATA, '.meta', `${KEY.split('/').join('__')}.json`), { force: true });
}
afterEach(cleanup);
afterAll(cleanup);

const at = '2026-10-20T00:00:00.000Z';

describe('presale ledger via writeJsonCas', () => {
  it('never oversells the cap under concurrent checkouts', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) =>
        reservePresaleUnits('p', { orderId: `o${i}`, email: `c${i}@x.co`, qty: 1, cap: 5, perCustomerLimit: 2, at }, KEY),
      ),
    );
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const doc = await readJson(KEY, PresaleLedgerDoc);
    expect(doc!.reservations.length).toBe(ok);
    expect(ok).toBeLessThanOrEqual(5);
  });
  it('enforces the per-customer limit and releases', async () => {
    await reservePresaleUnits('p', { orderId: 'a', email: 'me@x.co', qty: 2, perCustomerLimit: 2, at }, KEY);
    await expect(reservePresaleUnits('p', { orderId: 'b', email: 'me@x.co', qty: 1, perCustomerLimit: 2, at }, KEY)).rejects.toThrow(/limited/);
    await releasePresaleUnits('p', 'a', KEY);
    await reservePresaleUnits('p', { orderId: 'b', email: 'me@x.co', qty: 1, perCustomerLimit: 2, at }, KEY);
    expect((await readJson(KEY, PresaleLedgerDoc))!.reservations.map((r) => r.orderId)).toEqual(['b']);
  });
});

// ---- quote / checkout rules ----

const NOW = new Date('2026-10-20T00:00:00Z');
function prod(id: string, sku: string, over: Partial<Product> = {}): Product {
  return {
    id,
    slug: id,
    title: `Title ${id}`,
    description: '',
    categoryId: 'c',
    collectionIds: [],
    status: 'active',
    price: 300000,
    colours: [{ id: 'ink', name: 'Ink', hex: '#000000', images: [] }],
    sizes: ['M'],
    variants: [{ sku, colourId: 'ink', size: 'M' }],
    fabric: '',
    care: '',
    fit: '',
    sizeChartId: 's',
    relatedIds: [],
    sortOrder: 0,
    seo: {},
    createdAt: at,
    updatedAt: at,
    ...over,
  };
}
const settings = SettingsDoc.parse({ shipping: { flatFee: 0, freeShippingThreshold: 0 }, store: { email: 'a@b.co' } });
const pre = prod('pre', 'PRE-INK-M', { availability: 'presale', presale: { enabled: true, price: 250000, cap: 10, perCustomerLimit: 2, shipBy: '2026-12-15' } });
const gated = prod('gated', 'GAT-INK-M', { availability: 'presale', presale: { enabled: true, access: 'code', accessCode: 'EARLY' } });
const wait = prod('wait', 'WAI-INK-M', { availability: 'presale', presale: { enabled: true, access: 'waitlist' } });
const stock = prod('stock', 'STK-INK-M');
const soon = prod('soon', 'SOON-INK-M', { availability: 'coming_soon' });
const ctx: QuoteContext = {
  catalogue: CatalogueDoc.parse({ products: [pre, gated, wait, stock, soon] }),
  inventory: { 'STK-INK-M': { stock: 5, reserved: 0, lowStockAt: 3 }, 'SOON-INK-M': { stock: 5, reserved: 0, lowStockAt: 3 } },
  settings,
  coupons: [],
  now: NOW,
};

describe('buildQuote with launches', () => {
  it('prices presale server-side, ignores inventory and flags the order as pre-order', () => {
    const q = buildQuote(ctx, [{ sku: 'PRE-INK-M', qty: 2 }]);
    expect(q.issues).toEqual([]);
    expect(q.lines[0]).toMatchObject({ unitPrice: 250000, compareAtPrice: 300000, preorder: true });
    expect(q.preorder?.shipBy).toBe('2026-12-15');
  });
  it('rejects mixed presale + in-stock carts', () => {
    const q = buildQuote(ctx, [
      { sku: 'PRE-INK-M', qty: 1 },
      { sku: 'STK-INK-M', qty: 1 },
    ]);
    expect(q.mixedPresale).toBe(true);
    expect(() => assertCheckoutable(q, false)).toThrow(CheckoutError);
    try {
      assertCheckoutable(q, false);
    } catch (e) {
      expect((e as CheckoutError).code).toBe('mixed_cart');
    }
  });
  it('coming-soon items cannot be bought and do not leak their title', () => {
    const q = buildQuote(ctx, [{ sku: 'SOON-INK-M', qty: 1 }]);
    expect(q.issues[0]).toMatchObject({ issue: 'not_released' });
    expect(JSON.stringify(q)).not.toContain('Title soon');
  });
  it('F19: flags qty above the per-customer limit and carries the line ship date', () => {
    const q = buildQuote(ctx, [{ sku: 'PRE-INK-M', qty: 3 }]);
    expect(q.issues).toEqual([{ sku: 'PRE-INK-M', issue: 'presale_limit', available: 2 }]);
    expect(q.lines[0]).toMatchObject({ qty: 2, preorder: true, shipBy: '2026-12-15' });
  });
  it('pre-orders do not move inventory', () => {
    expect(inventoryLines({ preorder: true, lines: [] as never })).toEqual([]);
  });
});

describe('presaleGate (server-side access + cap)', () => {
  const mem = () => {
    const reserved: string[] = [];
    return {
      reserved,
      deps: {
        waitlist: async () => ['fan@x.co'],
        reserve: async (pid: string) => {
          reserved.push(pid);
          return { reservations: [] };
        },
        release: async (pid: string) => {
          reserved.splice(reserved.indexOf(pid), 1);
        },
      },
    };
  };
  it('requires a valid access code', async () => {
    const q = buildQuote(ctx, [{ sku: 'GAT-INK-M', qty: 1 }]);
    const m = mem();
    await expect(presaleGate(ctx, { email: 'a@x.co', presaleAccessCode: 'wrong' }, q, 'o1', NOW, m.deps)).rejects.toMatchObject({ code: 'presale_access', status: 403 });
    expect(m.reserved).toEqual([]);
    await presaleGate(ctx, { email: 'a@x.co', presaleAccessCode: 'early' }, q, 'o1', NOW, m.deps);
    expect(m.reserved).toEqual(['gated']);
  });
  it('waitlist-only requires the email on the notify list', async () => {
    const q = buildQuote(ctx, [{ sku: 'WAI-INK-M', qty: 1 }]);
    await expect(presaleGate(ctx, { email: 'other@x.co' }, q, 'o1', NOW, mem().deps)).rejects.toMatchObject({ code: 'presale_access' });
    const m = mem();
    const undo = await presaleGate(ctx, { email: 'fan@x.co' }, q, 'o1', NOW, m.deps);
    expect(m.reserved).toEqual(['wait']);
    await undo();
    expect(m.reserved).toEqual([]);
  });
});

describe('storefront projection', () => {
  it('only projected products reach surfaces', () => {
    const cat = projectCatalogue(ctx.catalogue, settings.launches, NOW);
    expect(cat.products.find((p) => p.id === 'gated')!.presale).toBeUndefined();
    expect(JSON.stringify(cat)).not.toContain('EARLY');
    expect(productsFor(ctx.catalogue, settings.launches, 'home', NOW).map((p) => p.id)).toEqual(['soon']);
  });
});
