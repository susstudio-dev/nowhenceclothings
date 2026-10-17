// C7. Stock decrement with ETag compare-and-swap. The decrement is a pure
// function of the inventory doc so writeJsonCas can safely re-run it.

import 'server-only';
import { writeJsonCas } from '@/lib/storage';
import { INVENTORY_KEY, InventoryDoc } from '@/lib/schemas/inventory';
import { applyStockDecrement } from './stock-core';

export { applyStockDecrement, OversellError } from './stock-core';

/**
 * Atomically decrements every line or none. Throws OversellError (nothing
 * written) when any SKU lacks stock; CasConflictError if retries run out.
 */
export async function commitStock(
  lines: { sku: string; qty: number }[],
  key: string = INVENTORY_KEY,
): Promise<InventoryDoc> {
  return writeJsonCas(key, InventoryDoc, (inv) => applyStockDecrement(inv ?? {}, lines));
}
