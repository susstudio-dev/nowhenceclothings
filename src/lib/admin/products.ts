import 'server-only';
import { writeJsonCas } from '@/lib/storage';
import { CATALOGUE_KEY, CatalogueDoc, type Product } from '@/lib/schemas/catalogue';
import { INVENTORY_KEY, InventoryDoc } from '@/lib/schemas/inventory';
import { NotFoundError, syncInventory, upsertProduct } from './catalogue-mutations';
import { removedSkus } from './variants';
import { HttpError } from './api';
import type { ProductBody } from './inputs';

/**
 * Save a product (create when `mode` = 'create', else update) and keep the
 * inventory doc in step with its SKUs. Two CAS writes; inventory sync is
 * idempotent so a retry after a partial failure converges.
 */
export async function saveProduct(body: ProductBody, mode: 'create' | 'update'): Promise<Product> {
  const now = new Date();
  let before: Product | undefined;
  const doc = await writeJsonCas(CATALOGUE_KEY, CatalogueDoc, (cur) => {
    const cat = cur ?? CatalogueDoc.parse({});
    before = cat.products.find((p) => p.id === body.id);
    if (mode === 'create' && before) throw new HttpError(409, `Product id ${body.id} already exists`);
    if (mode === 'update' && !before) throw new NotFoundError(`Product ${body.id}`);
    const product = { ...body, createdAt: body.createdAt ?? now.toISOString(), updatedAt: now.toISOString() } as Product;
    return upsertProduct(cat, product, now);
  });
  const saved = doc.products.find((p) => p.id === body.id)!;
  const removed = before ? removedSkus(before.variants, saved.variants) : [];
  await writeJsonCas(
    INVENTORY_KEY,
    InventoryDoc,
    (inv) => syncInventory(inv ?? {}, saved.variants.map((v) => v.sku), removed),
    { initial: () => ({}) },
  );
  return saved;
}
