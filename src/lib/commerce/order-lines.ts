import type { Order } from '@/lib/schemas/order';

/** Lines that move inventory. A11: pre-orders count against the presale cap, not stock. Pure. */
export function inventoryLines(o: Pick<Order, 'lines' | 'preorder'>): { sku: string; qty: number }[] {
  return o.preorder ? [] : o.lines.map((l) => ({ sku: l.sku, qty: l.qty }));
}
