import type { InventoryDoc } from '@/lib/schemas/inventory';

export class OversellError extends Error {
  constructor(readonly shortfalls: { sku: string; requested: number; available: number }[]) {
    super(`oversell: ${shortfalls.map((s) => `${s.sku} (${s.requested}/${s.available})`).join(', ')}`);
    this.name = 'OversellError';
  }
}

/** Returns a new inventory with all lines decremented, or throws OversellError. Pure. */
export function applyStockDecrement(inv: InventoryDoc, lines: { sku: string; qty: number }[]): InventoryDoc {
  const want = new Map<string, number>();
  for (const l of lines) want.set(l.sku, (want.get(l.sku) ?? 0) + l.qty);
  const shortfalls: { sku: string; requested: number; available: number }[] = [];
  for (const [sku, qty] of want) {
    const have = inv[sku]?.stock ?? 0;
    if (have < qty) shortfalls.push({ sku, requested: qty, available: Math.max(0, have) });
  }
  if (shortfalls.length) throw new OversellError(shortfalls);
  const next: InventoryDoc = { ...inv };
  for (const [sku, qty] of want) {
    const level = inv[sku]!;
    next[sku] = { ...level, stock: level.stock - qty };
  }
  return next;
}
