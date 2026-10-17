import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CatalogueDoc } from '@/lib/schemas/catalogue';
import { CouponsDoc, type Coupon } from '@/lib/schemas/coupons';
import { InventoryDoc } from '@/lib/schemas/inventory';
import {
  applySale,
  applyStockEdits,
  moveItem,
  NotFoundError,
  removeCoupon,
  setAlt,
  setProductStatus,
  stockRows,
  syncInventory,
  upsertCoupon,
  upsertProduct,
} from './catalogue-mutations';

const load = (f: string) => JSON.parse(readFileSync(path.join(process.cwd(), 'data', f), 'utf8'));
const cat = CatalogueDoc.parse(load('catalogue.json'));
const inv = InventoryDoc.parse(load('inventory.json'));
const now = new Date('2026-10-17T00:00:00.000Z');

describe('products', () => {
  it('upsert keeps createdAt on update and stays schema-valid', () => {
    const p = cat.products[0];
    const out = upsertProduct(cat, { ...p, title: 'Renamed', createdAt: '2020-01-01T00:00:00.000Z' }, now);
    const saved = out.products.find((x) => x.id === p.id)!;
    expect(saved.title).toBe('Renamed');
    expect(saved.createdAt).toBe(p.createdAt);
    expect(saved.updatedAt).toBe(now.toISOString());
    expect(() => CatalogueDoc.parse(out)).not.toThrow();
  });
  it('upsert of a duplicate slug fails catalogue validation', () => {
    const p = cat.products[0];
    const clone = { ...p, id: 'new', variants: p.variants.map((v) => ({ ...v, sku: `${v.sku}-X` })) };
    expect(CatalogueDoc.safeParse(upsertProduct(cat, clone, now)).success).toBe(false);
  });
  it('setProductStatus archives / throws for unknown', () => {
    const out = setProductStatus(cat, cat.products[0].id, 'archived', now);
    expect(out.products[0].status).toBe('archived');
    expect(() => setProductStatus(cat, 'nope', 'active')).toThrow(NotFoundError);
  });
  it('moveItem / setAlt', () => {
    expect(moveItem([1, 2, 3], 0, 2)).toEqual([2, 3, 1]);
    expect(moveItem([1, 2, 3], 5, 0)).toEqual([1, 2, 3]);
    const imgs = cat.products[0].colours[0].images;
    expect(setAlt(imgs, imgs[0].id, 'New alt')[0].alt).toBe('New alt');
  });
});

describe('inventory', () => {
  it('sync adds missing SKUs at 0 and removes dropped ones', () => {
    const out = syncInventory({ A: { stock: 5, reserved: 0, lowStockAt: 3 }, OLD: { stock: 1, reserved: 0, lowStockAt: 3 } }, ['A', 'B'], ['OLD']);
    expect(out).toEqual({ A: { stock: 5, reserved: 0, lowStockAt: 3 }, B: { stock: 0, reserved: 0, lowStockAt: 3 } });
  });
  it('applyStockEdits sets absolute values, keeps reserved', () => {
    const out = applyStockEdits({ A: { stock: 5, reserved: 2, lowStockAt: 3 } }, [{ sku: 'A', stock: 9 }, { sku: 'N', lowStockAt: 1 }]);
    expect(out.A).toEqual({ stock: 9, reserved: 2, lowStockAt: 3 });
    expect(out.N).toEqual({ stock: 0, reserved: 0, lowStockAt: 1 });
  });
  it('stockRows covers every non-archived variant; lowOnly filters', () => {
    const all = stockRows(cat, inv);
    const live = cat.products.filter((p) => p.status !== 'archived').reduce((n, p) => n + p.variants.length, 0);
    expect(all).toHaveLength(live);
    const sku = all[0].sku;
    const low = stockRows(cat, { ...inv, [sku]: { stock: 0, reserved: 0, lowStockAt: 3 } }, { lowOnly: true });
    expect(low.some((r) => r.sku === sku && r.low)).toBe(true);
    expect(low.every((r) => r.low)).toBe(true);
  });
});

describe('coupons + sale', () => {
  const base: Coupon = { id: 'c1', code: 'HELLO', type: 'flat', value: 5000, description: '', active: true, minOrder: 0, usedCount: 4, createdAt: '2026-01-01T00:00:00.000Z' };
  it('upsert preserves server-owned usedCount/createdAt and rejects duplicate codes', () => {
    const doc = { coupons: [base] };
    const out = upsertCoupon(doc, { ...base, value: 9000, usedCount: 0, createdAt: now.toISOString() });
    expect(out.coupons[0]).toMatchObject({ value: 9000, usedCount: 4, createdAt: base.createdAt });
    expect(() => upsertCoupon(doc, { ...base, id: 'c2' })).toThrow(/already exists/);
    expect(() => CouponsDoc.parse(upsertCoupon(doc, { ...base, id: 'c2', code: 'OTHER' }))).not.toThrow();
  });
  it('removeCoupon', () => {
    expect(removeCoupon({ coupons: [base] }, 'c1').coupons).toEqual([]);
    expect(() => removeCoupon({ coupons: [] }, 'c1')).toThrow(NotFoundError);
  });
  it('applySale discounts from the regular price and ending restores it', () => {
    const p = cat.products[0];
    const on = applySale(cat, [p.id], { percentOff: 20 }, now);
    const sp = on.products[0];
    expect(sp.compareAtPrice).toBe(p.price);
    expect(sp.price).toBe(Math.round((p.price * 0.8) / 100) * 100);
    expect(sp.price % 100).toBe(0);
    // Re-applying a different % uses the regular price, not the sale price.
    expect(applySale(on, [p.id], { percentOff: 50 }, now).products[0].compareAtPrice).toBe(p.price);
    const off = applySale(on, [p.id], null, now).products[0];
    expect(off.price).toBe(p.price);
    expect(off.compareAtPrice).toBeUndefined();
    expect(() => CatalogueDoc.parse(on)).not.toThrow();
    expect(on.products[1]).toBe(cat.products[1]);
  });
});
