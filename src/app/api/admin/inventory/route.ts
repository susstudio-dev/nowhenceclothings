import { writeJsonCas } from '@/lib/storage';
import { INVENTORY_KEY, InventoryDoc } from '@/lib/schemas/inventory';
import { adminRoute, json, readBody } from '@/lib/admin/api';
import { StockInput } from '@/lib/admin/inputs';
import { applyStockEdits } from '@/lib/admin/catalogue-mutations';

export const dynamic = 'force-dynamic';

/** A3: per-variant stock / low-stock threshold edits (absolute values). */
export async function PATCH(req: Request) {
  return adminRoute({ role: 'manager', cap: 'inventory.write' }, async ({ log }) => {
    const { edits } = await readBody(req, StockInput);
    const inventory = await writeJsonCas(INVENTORY_KEY, InventoryDoc, (cur) => applyStockEdits(cur ?? {}, edits), {
      initial: () => ({}),
    });
    await log(
      'inventory_update',
      'inventory.json',
      edits.map((e) => `${e.sku}${e.stock !== undefined ? `=${e.stock}` : ''}`).join(', '),
    );
    return json({ inventory });
  });
}
