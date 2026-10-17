import { promises as fs } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readJson, writeJsonCas } from '@/lib/storage';
import { InventoryDoc } from '@/lib/schemas/inventory';
import { applyStockDecrement, commitStock, OversellError } from './stock';

const KEY = '__test__/commerce-inventory.json';
const level = (stock: number) => ({ stock, reserved: 0, lowStockAt: 3 });

afterAll(async () => {
  await fs.rm(path.join(process.env.NOWHENCE_DATA_DIR ?? path.join(process.cwd(), 'data'), '__test__', 'commerce-inventory.json'), { force: true });
  await fs.rm(path.join(process.env.NOWHENCE_DATA_DIR ?? path.join(process.cwd(), 'data'), '.meta', '__test____commerce-inventory.json.json'), { force: true });
});

describe('applyStockDecrement (pure)', () => {
  it('decrements and merges duplicate skus', () => {
    const inv = { A: level(5), B: level(2) };
    const next = applyStockDecrement(inv, [
      { sku: 'A', qty: 2 },
      { sku: 'A', qty: 1 },
      { sku: 'B', qty: 2 },
    ]);
    expect(next.A!.stock).toBe(2);
    expect(next.B!.stock).toBe(0);
    expect(inv.A.stock).toBe(5);
  });
  it('is all-or-nothing on oversell', () => {
    const inv = { A: level(5), B: level(1) };
    let caught: unknown;
    try {
      applyStockDecrement(inv, [
        { sku: 'A', qty: 1 },
        { sku: 'B', qty: 2 },
        { sku: 'C', qty: 1 },
      ]);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(OversellError);
    expect((caught as OversellError).shortfalls.map((s) => s.sku)).toEqual(['B', 'C']);
  });
});

describe('commitStock (CAS)', () => {
  it('never oversells under concurrent confirmations', async () => {
    await writeJsonCas(KEY, InventoryDoc, () => ({ A: level(3) }), { initial: () => ({}) });
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => commitStock([{ sku: 'A', qty: 1 }], KEY)));
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const oversold = results.filter((r) => r.status === 'rejected' && r.reason instanceof OversellError).length;
    expect(ok).toBe(3);
    expect(oversold).toBe(3);
    expect((await readJson(KEY, InventoryDoc))!.A!.stock).toBe(0);
  });
});
