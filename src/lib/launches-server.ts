// Server-side launch helpers (A10/A11): the storefront catalogue projection,
// presale ledgers and notify lists. Pages read products ONLY through these so
// coming-soon secrecy holds everywhere.

import 'server-only';
import { getCatalogue } from './catalogue';
import { getSettings } from './content';
import { readJson, writeJsonCas } from './storage';
import type { CatalogueDoc, Product } from './schemas/catalogue';
import { NotifyDoc } from './schemas/logs';
import { PresaleLedgerDoc, presaleLedgerKey, productNotifyKey } from './schemas/launches';
import type { LaunchDefaults } from './schemas/launches';
import { listedOn, releasePresale, reservePresale, toPublicProduct, type PublicProduct, type Surface } from './launches';

export interface StorefrontCatalogue extends Omit<CatalogueDoc, 'products'> {
  /** Active products, projected (secrets removed), sorted. */
  products: PublicProduct[];
}

/** Pure: project + sort the active products of a catalogue. */
export function projectCatalogue(cat: CatalogueDoc, d: LaunchDefaults, now: Date = new Date()): StorefrontCatalogue {
  const products = cat.products
    .filter((p) => p.status === 'active')
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((p) => toPublicProduct(p, cat.drops, d, now));
  return { ...cat, drops: publicDrops(cat.drops), products };
}

/** Drops without their presale config (access codes stay server-side). Pure. */
export function publicDrops(drops: CatalogueDoc['drops']): CatalogueDoc['drops'] {
  return drops.map(({ presale: _p, ...d }) => d);
}

/** Pure: projected products for one surface. */
export function productsFor(cat: CatalogueDoc, d: LaunchDefaults, surface: Surface, now: Date = new Date()): PublicProduct[] {
  const byId = new Map(cat.products.map((p) => [p.id, p]));
  return projectCatalogue(cat, d, now).products.filter((p) => listedOn(p, surface, byId.get(p.id), d));
}

export async function getLaunchDefaults(): Promise<LaunchDefaults> {
  return (await getSettings()).launches;
}

/** Storefront catalogue: projected active products (all surfaces). */
export async function getStorefrontCatalogue(now: Date = new Date()): Promise<StorefrontCatalogue> {
  const [cat, d] = await Promise.all([getCatalogue(), getLaunchDefaults()]);
  return projectCatalogue(cat, d, now);
}

/** Projected products listed on a surface (shop grids, home section, /coming-soon). */
export async function getStorefrontProducts(surface: Surface, now: Date = new Date()): Promise<PublicProduct[]> {
  const [cat, d] = await Promise.all([getCatalogue(), getLaunchDefaults()]);
  return productsFor(cat, d, surface, now);
}

/** Projected product by slug (active only). */
export async function getStorefrontProduct(slug: string, now: Date = new Date()): Promise<PublicProduct | null> {
  const cat = await getStorefrontCatalogue(now);
  return cat.products.find((p) => p.slug === slug) ?? null;
}

// ---- notify list (per product) ----

export async function readProductNotifyList(productId: string): Promise<NotifyDoc['subscribers']> {
  return (await readJson(productNotifyKey(productId), NotifyDoc))?.subscribers ?? [];
}

/** Emails on the product's notify list plus every SKU-level list for it. */
export async function waitlistEmails(product: Product): Promise<string[]> {
  const keys = [productNotifyKey(product.id), ...product.variants.map((v) => `notify/${v.sku}.json`)];
  const docs = await Promise.all(keys.map((k) => readJson(k, NotifyDoc)));
  return [...new Set(docs.flatMap((d) => d?.subscribers.map((s) => s.email) ?? []))];
}

// ---- presale ledger ----

export async function readPresaleLedger(productId: string): Promise<PresaleLedgerDoc> {
  return (await readJson(presaleLedgerKey(productId), PresaleLedgerDoc)) ?? { reservations: [] };
}

export async function reservePresaleUnits(
  productId: string,
  req: Parameters<typeof reservePresale>[1],
  key: string = presaleLedgerKey(productId),
): Promise<PresaleLedgerDoc> {
  return writeJsonCas(key, PresaleLedgerDoc, (cur) => reservePresale(cur ?? { reservations: [] }, req), {
    initial: () => ({ reservations: [] }),
  });
}

export async function releasePresaleUnits(productId: string, orderId: string, key: string = presaleLedgerKey(productId)): Promise<void> {
  const cur = await readJson(key, PresaleLedgerDoc);
  if (!cur || !cur.reservations.some((r) => r.orderId === orderId)) return;
  await writeJsonCas(key, PresaleLedgerDoc, (c) => releasePresale(c ?? { reservations: [] }, orderId));
}

/** Catalogue for block renderers / listings: products = projected + listed in the shop. */
export async function getShopCatalogue(now: Date = new Date()): Promise<CatalogueDoc> {
  const [cat, d] = await Promise.all([getCatalogue(), getLaunchDefaults()]);
  return { ...cat, drops: publicDrops(cat.drops), products: productsFor(cat, d, 'shop', now) };
}
