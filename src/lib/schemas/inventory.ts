import { z } from 'zod';

export const INVENTORY_KEY = 'inventory.json';

export const StockLevel = z.object({
  stock: z.number().int().nonnegative(),
  /** Units held by pending_payment orders (informational; stock decrements on payment). */
  reserved: z.number().int().nonnegative().default(0),
  lowStockAt: z.number().int().nonnegative().default(3),
});
export type StockLevel = z.infer<typeof StockLevel>;

/** `{ [sku]: StockLevel }` */
export const InventoryDoc = z.record(z.string(), StockLevel);
export type InventoryDoc = z.infer<typeof InventoryDoc>;

/** Units purchasable right now. */
export function available(level: StockLevel | undefined): number {
  return level ? Math.max(0, level.stock) : 0;
}
