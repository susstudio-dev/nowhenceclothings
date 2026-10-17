import { describe, expect, it } from 'vitest';
import { Order, summarize, type OrderSummary } from '@/lib/schemas/order';
import {
  applyOrderPatch,
  csvField,
  filterOrders,
  nextStatuses,
  OrderTransitionError,
  ordersToCsv,
  upsertSummary,
} from './orders';

const T0 = '2026-10-01T10:00:00.000Z';
const now = new Date('2026-10-02T12:00:00.000Z');

const order = (over: Partial<Order> = {}): Order =>
  Order.parse({
    id: 'ord-1',
    number: 'NWH-261001-AB12',
    email: 'a@b.in',
    phone: '9876543210',
    shippingAddress: { name: 'Asha, R', line1: '1 Road', city: 'Pune', state: 'MH', pincode: '411001' },
    lines: [{ sku: 'TEE-BONE-M', productId: 'p1', title: 'Tee', colour: 'Bone', size: 'M', qty: 2, unitPrice: 249900 }],
    subtotal: 499800,
    discount: 0,
    shipping: 0,
    total: 499800,
    status: 'paid',
    razorpayOrderId: 'order_x',
    history: [{ at: T0, status: 'paid', by: 'webhook' }],
    createdAt: T0,
    updatedAt: T0,
    ...over,
  });

describe('applyOrderPatch', () => {
  it('moves along an allowed transition and records history', () => {
    const o = applyOrderPatch(order(), { status: 'packed', note: 'boxed' }, 'ops@n.in', now);
    expect(o.status).toBe('packed');
    expect(o.history.at(-1)).toEqual({ at: now.toISOString(), status: 'packed', by: 'ops@n.in', note: 'boxed' });
    expect(o.updatedAt).toBe(now.toISOString());
    expect(() => Order.parse(o)).not.toThrow();
  });

  it('rejects transitions C9 does not allow', () => {
    expect(() => applyOrderPatch(order(), { status: 'delivered' }, 'x')).toThrow(OrderTransitionError);
    expect(() => applyOrderPatch(order({ status: 'refunded' }), { status: 'paid' }, 'x')).toThrow(OrderTransitionError);
  });

  it('requires tracking before shipped, accepts it in the same patch', () => {
    const packed = order({ status: 'packed' });
    expect(() => applyOrderPatch(packed, { status: 'shipped' }, 'x')).toThrow(/tracking/);
    const o = applyOrderPatch(packed, { status: 'shipped', tracking: { carrier: 'Delhivery', number: 'D1' } }, 'x', now);
    expect(o.status).toBe('shipped');
    expect(o.tracking?.number).toBe('D1');
  });

  it('records a refund, moves to refunded and caps the amount', () => {
    const o = applyOrderPatch(order(), { refund: { amount: 100000, reason: 'size' } }, 'x', now);
    expect(o.status).toBe('refunded');
    expect(o.refund).toMatchObject({ amount: 100000, reason: 'size', at: now.toISOString() });
    expect(() => applyOrderPatch(order(), { refund: { amount: 499801 } }, 'x')).toThrow(/exceed/);
    expect(() => applyOrderPatch(order({ status: 'pending_payment' }), { refund: { amount: 1 } }, 'x')).toThrow(OrderTransitionError);
  });

  it('a note alone adds history without changing status; does not mutate input', () => {
    const src = order();
    const o = applyOrderPatch(src, { note: 'called customer' }, 'x', now);
    expect(o.status).toBe('paid');
    expect(o.history).toHaveLength(2);
    expect(src.history).toHaveLength(1);
  });

  it('nextStatuses mirrors ORDER_TRANSITIONS', () => {
    expect(nextStatuses('shipped')).toEqual(['delivered', 'refunded']);
  });
});

describe('index + filter', () => {
  const s = (id: string, createdAt: string, over: Partial<OrderSummary> = {}): OrderSummary => ({
    ...summarize(order({ id, createdAt })),
    ...over,
  });
  it('upsertSummary replaces by id and sorts newest first', () => {
    const list = [s('a', '2026-10-01T00:00:00.000Z'), s('b', '2026-10-03T00:00:00.000Z')];
    const out = upsertSummary(list, s('a', '2026-10-01T00:00:00.000Z', { status: 'packed' }));
    expect(out.map((o) => o.id)).toEqual(['b', 'a']);
    expect(out[1].status).toBe('packed');
  });
  it('filters by status and free text', () => {
    const list = [s('a', T0), s('b', T0, { status: 'shipped', email: 'z@q.in' })];
    expect(filterOrders(list, { status: 'shipped' }).map((o) => o.id)).toEqual(['b']);
    expect(filterOrders(list, { q: 'Z@Q' }).map((o) => o.id)).toEqual(['b']);
    expect(filterOrders(list, { status: 'all' })).toHaveLength(2);
  });
});

describe('CSV', () => {
  it('escapes quotes, commas, newlines and formula prefixes', () => {
    expect(csvField('plain')).toBe('plain');
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvField('-5')).toBe("'-5");
    expect(csvField(undefined)).toBe('');
  });
  it('emits a header and one row per order in rupees', () => {
    const csv = ordersToCsv([order({ couponCode: 'WELCOME10' })]);
    const lines = csv.trimEnd().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[0].startsWith('number,created_at,status')).toBe(true);
    expect(lines[1]).toContain('NWH-261001-AB12');
    expect(lines[1]).toContain('"Asha, R"');
    expect(lines[1]).toContain('TEE-BONE-M x 2');
    expect(lines[1]).toContain('4998.00');
    expect(lines[1]).toContain('WELCOME10');
  });
});
