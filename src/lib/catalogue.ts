import 'server-only';
import { readJson } from './storage';
import { CATALOGUE_KEY, CatalogueDoc, type Drop, type Product } from './schemas/catalogue';
import { INVENTORY_KEY, InventoryDoc, available, type StockLevel } from './schemas/inventory';
import { SIZES, type Size } from './schemas/common';
import { resolveSizeCharts } from './size-charts';

// Read-side catalogue API. Writes go through writeJsonCas(CATALOGUE_KEY, ...)
// in the admin workstream. Reads hit storage each call (R2 is strongly
// consistent; no per-isolate cache so admin edits show immediately).

const EMPTY: CatalogueDoc = {
  version: 1,
  products: [],
  categories: [],
  collections: [],
  drops: [],
  sizeCharts: [],
};

/** Whole catalogue doc (all statuses). Empty catalogue when absent. */
export async function getCatalogue(): Promise<CatalogueDoc> {
  return normaliseCatalogue((await readJson(CATALOGUE_KEY, CatalogueDoc)) ?? EMPTY);
}

/** Sizes in XS..XXL order, whatever order they were ticked in. Pure. */
export function orderSizes<T extends Size>(sizes: readonly T[]): T[] {
  return [...sizes].sort((a, b) => SIZES.indexOf(a) - SIZES.indexOf(b));
}

/** Read-side view: sizes in order, placeholder size charts resolved. Pure; never written back. */
export function normaliseCatalogue(doc: CatalogueDoc): CatalogueDoc {
  return {
    ...doc,
    products: doc.products.map((p) => ({ ...p, sizes: orderSizes(p.sizes) })),
    sizeCharts: resolveSizeCharts(doc.sizeCharts),
  };
}

/** Products shoppers may see (status 'active'). */
export async function getActiveProducts(): Promise<Product[]> {
  const cat = await getCatalogue();
  return cat.products.filter((p) => p.status === 'active').sort((a, b) => a.sortOrder - b.sortOrder);
}

/** By slug. Only 'active' unless `includeDrafts` (admin preview). */
export async function getProductBySlug(
  slug: string,
  opts: { includeDrafts?: boolean } = {},
): Promise<Product | null> {
  const cat = await getCatalogue();
  const p = cat.products.find((x) => x.slug === slug);
  if (!p) return null;
  if (!opts.includeDrafts && p.status !== 'active') return null;
  return p;
}

export async function getProductById(id: string): Promise<Product | null> {
  const cat = await getCatalogue();
  return cat.products.find((p) => p.id === id) ?? null;
}

/** Find product + variant for a SKU. */
export async function findVariant(sku: string) {
  const cat = await getCatalogue();
  for (const product of cat.products) {
    const variant = product.variants.find((v) => v.sku === sku);
    if (variant) return { product, variant, colour: product.colours.find((c) => c.id === variant.colourId)! };
  }
  return null;
}

/** Whole inventory doc ({} when absent). */
export async function getInventory(): Promise<InventoryDoc> {
  return (await readJson(INVENTORY_KEY, InventoryDoc)) ?? {};
}

/** Units purchasable for a SKU (0 when unknown). */
export async function getStock(sku: string): Promise<number> {
  const inv = await getInventory();
  return available(inv[sku]);
}

/** Raw stock record for a SKU. */
export async function getStockLevel(sku: string): Promise<StockLevel | null> {
  const inv = await getInventory();
  return inv[sku] ?? null;
}

/** S4: a product in an unreleased drop is visible but not purchasable. Pure. */
export function isReleased(product: Product, drops: Drop[], now: Date = new Date()): boolean {
  if (!product.dropId) return true;
  const drop = drops.find((d) => d.id === product.dropId);
  return !drop || new Date(drop.releaseAt).getTime() <= now.getTime();
}
