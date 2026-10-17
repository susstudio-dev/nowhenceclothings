import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CatalogueDoc,
  Coupon,
  CouponsDoc,
  InventoryDoc,
  Order,
  OrderNumber,
  STATIC_PAGE_SLUGS,
  SettingsDoc,
  SiteContentDoc,
  UsersDoc,
  canTransition,
  newOrderNumber,
  ordersIndexKey,
  summarize,
} from './index';

const seed = (name: string) => JSON.parse(readFileSync(path.join(process.cwd(), 'data', name), 'utf8'));

describe('seed data validates', () => {
  const cat = CatalogueDoc.parse(seed('catalogue.json'));
  const inv = InventoryDoc.parse(seed('inventory.json'));

  it('catalogue: 13 active products (8 core + 5 launch polos), 2 categories, 1 collection, 1 drop', () => {
    expect(cat.products).toHaveLength(13);
    expect(cat.products.every((p) => p.status === 'active')).toBe(true);
    expect(cat.categories).toHaveLength(2);
    expect(cat.collections).toHaveLength(1);
    expect(cat.drops).toHaveLength(1);
  });

  it('every variant has inventory and every reference resolves', () => {
    const charts = new Set(cat.sizeCharts.map((c) => c.id));
    const cats = new Set(cat.categories.map((c) => c.id));
    for (const p of cat.products) {
      expect(cats.has(p.categoryId)).toBe(true);
      expect(charts.has(p.sizeChartId)).toBe(true);
      for (const v of p.variants) expect(inv[v.sku]).toBeDefined();
    }
  });

  it('settings, coupons and site content', () => {
    expect(SettingsDoc.parse(seed('settings.json')).shipping.freeShippingThreshold).toBeGreaterThan(0);
    expect(CouponsDoc.parse(seed('coupons.json')).coupons.map((c) => c.type).sort()).toEqual([
      'flat',
      'free_shipping',
      'percent',
    ]);
    const content = SiteContentDoc.parse(seed('site-content.json'));
    for (const slug of STATIC_PAGE_SLUGS) expect(content.pages[slug]).toBeDefined();
  });
});

describe('catalogue integrity refinements', () => {
  it('rejects duplicate SKUs and unknown colour ids', () => {
    const cat = seed('catalogue.json');
    cat.products[1].variants[0].sku = cat.products[0].variants[0].sku;
    cat.products[0].variants[1].colourId = 'nope';
    const res = CatalogueDoc.safeParse(cat);
    expect(res.success).toBe(false);
    expect(res.error!.issues.map((i) => i.message).join()).toMatch(/duplicate sku.*|unknown colourId/);
  });

  it('rejects non-integer paise', () => {
    const cat = seed('catalogue.json');
    cat.products[0].price = 2499.5;
    expect(CatalogueDoc.safeParse(cat).success).toBe(false);
  });
});

describe('coupons', () => {
  it('normalises code to upper-case and enforces percent bounds', () => {
    const base = { id: 'c', createdAt: '2026-10-17T00:00:00.000Z' };
    expect(Coupon.parse({ ...base, code: ' save10 ', type: 'percent', value: 10 }).code).toBe('SAVE10');
    expect(Coupon.safeParse({ ...base, code: 'X1X', type: 'percent', value: 120 }).success).toBe(false);
  });
});

describe('orders', () => {
  it('generates valid order numbers', () => {
    const n = newOrderNumber(new Date('2026-10-17T10:00:00Z'));
    expect(n).toMatch(/^NWH-261017-/);
    expect(OrderNumber.safeParse(n).success).toBe(true);
  });

  it('enforces the C9 state machine', () => {
    expect(canTransition('pending_payment', 'paid')).toBe(true);
    expect(canTransition('paid', 'shipped')).toBe(false);
    expect(canTransition('refunded', 'paid')).toBe(false);
  });

  it('parses an order and summarises it', () => {
    const at = '2026-10-17T10:00:00.000Z';
    const order = Order.parse({
      id: 'o1',
      number: 'NWH-261017-AB12',
      email: 'A@Example.com',
      phone: '9876543210',
      shippingAddress: { name: 'A', line1: 'x', city: 'Mumbai', state: 'MH', pincode: '400001' },
      lines: [{ sku: 'NWH-TEE-BON-M', productId: 'p', title: 'Tee', colour: 'Bone', size: 'M', qty: 2, unitPrice: 249900 }],
      subtotal: 499800,
      discount: 0,
      shipping: 0,
      total: 499800,
      status: 'pending_payment',
      razorpayOrderId: 'order_x',
      history: [{ at, status: 'pending_payment', by: 'customer' }],
      createdAt: at,
      updatedAt: at,
    });
    expect(order.email).toBe('a@example.com');
    expect(summarize(order).itemCount).toBe(2);
    expect(ordersIndexKey(at)).toBe('orders-index/2026-10.json');
  });
});

describe('users', () => {
  it('only accepts the three roles', () => {
    const u = { id: '1', email: 'a@b.co', passwordHash: 'x' };
    expect(UsersDoc.safeParse({ users: [{ ...u, role: 'manager' }] }).success).toBe(true);
    expect(UsersDoc.safeParse({ users: [{ ...u, role: 'viewer' }] }).success).toBe(false);
  });
});
