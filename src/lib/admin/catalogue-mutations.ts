// Pure catalogue / inventory / coupon mutations, run inside writeJsonCas.
import type { CatalogueDoc, Product, SizeChart } from '@/lib/schemas/catalogue';
import type { InventoryDoc } from '@/lib/schemas/inventory';
import type { Coupon, CouponsDoc } from '@/lib/schemas/coupons';
import type { MediaRef } from '@/lib/schemas/common';

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = 'NotFoundError';
  }
}

/** Insert or replace a product by id. Keeps createdAt from the stored copy. */
export function upsertProduct(doc: CatalogueDoc, product: Product, now: Date = new Date()): CatalogueDoc {
  const at = now.toISOString();
  const idx = doc.products.findIndex((p) => p.id === product.id);
  const products = [...doc.products];
  if (idx === -1) products.push({ ...product, createdAt: product.createdAt || at, updatedAt: at });
  else products[idx] = { ...product, createdAt: doc.products[idx].createdAt, updatedAt: at };
  return { ...doc, products };
}

export function setProductStatus(
  doc: CatalogueDoc,
  id: string,
  status: Product['status'],
  now: Date = new Date(),
): CatalogueDoc {
  if (!doc.products.some((p) => p.id === id)) throw new NotFoundError(`Product ${id}`);
  return {
    ...doc,
    products: doc.products.map((p) => (p.id === id ? { ...p, status, updatedAt: now.toISOString() } : p)),
  };
}

/** Insert or replace a size chart by id (a resolved placeholder chart saves over its seed copy). */
export function upsertSizeChart(doc: CatalogueDoc, chart: SizeChart): CatalogueDoc {
  const exists = doc.sizeCharts.some((c) => c.id === chart.id);
  return {
    ...doc,
    sizeCharts: exists ? doc.sizeCharts.map((c) => (c.id === chart.id ? chart : c)) : [...doc.sizeCharts, chart],
  };
}

/** Remove a size chart. Refused while any product, archived included, still points at it. */
export function removeSizeChart(doc: CatalogueDoc, id: string): CatalogueDoc {
  if (!doc.sizeCharts.some((c) => c.id === id)) throw new NotFoundError(`Size chart ${id}`);
  const users = doc.products.filter((p) => p.sizeChartId === id).map((p) => p.title);
  if (users.length) {
    throw new Error(`Cannot delete: used by ${users.slice(0, 3).join(', ')}${users.length > 3 ? ` and ${users.length - 3} more` : ''}`);
  }
  return { ...doc, sizeCharts: doc.sizeCharts.filter((c) => c.id !== id) };
}

/** Move an item from one index to another (drag reorder). Out of range = no-op. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const out = [...list];
  if (from < 0 || from >= out.length || to < 0 || to >= out.length || from === to) return out;
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item);
  return out;
}

export function setAlt(images: MediaRef[], id: string, alt: string): MediaRef[] {
  return images.map((m) => (m.id === id ? { ...m, alt } : m));
}

/** Ensure every SKU has an inventory row; drop rows for removed SKUs. */
export function syncInventory(inv: InventoryDoc, skus: string[], removed: string[] = []): InventoryDoc {
  const next: InventoryDoc = { ...inv };
  for (const s of removed) delete next[s];
  for (const s of skus) if (!next[s]) next[s] = { stock: 0, reserved: 0, lowStockAt: 3 };
  return next;
}

export interface StockEdit {
  sku: string;
  stock?: number;
  lowStockAt?: number;
}

export function applyStockEdits(inv: InventoryDoc, edits: StockEdit[]): InventoryDoc {
  const next: InventoryDoc = { ...inv };
  for (const e of edits) {
    const cur = next[e.sku] ?? { stock: 0, reserved: 0, lowStockAt: 3 };
    next[e.sku] = {
      ...cur,
      ...(e.stock !== undefined ? { stock: e.stock } : {}),
      ...(e.lowStockAt !== undefined ? { lowStockAt: e.lowStockAt } : {}),
    };
  }
  return next;
}

export interface StockRow {
  sku: string;
  productId: string;
  productTitle: string;
  colour: string;
  size: string;
  stock: number;
  lowStockAt: number;
  low: boolean;
}

/** Flattened inventory rows for every non-archived variant. */
export function stockRows(cat: CatalogueDoc, inv: InventoryDoc, opts: { lowOnly?: boolean } = {}): StockRow[] {
  const rows: StockRow[] = [];
  for (const p of cat.products) {
    if (p.status === 'archived') continue;
    for (const v of p.variants) {
      const lvl = inv[v.sku];
      const stock = lvl?.stock ?? 0;
      const lowStockAt = lvl?.lowStockAt ?? 3;
      const row: StockRow = {
        sku: v.sku,
        productId: p.id,
        productTitle: p.title,
        colour: p.colours.find((c) => c.id === v.colourId)?.name ?? v.colourId,
        size: v.size,
        stock,
        lowStockAt,
        low: stock <= lowStockAt,
      };
      if (!opts.lowOnly || row.low) rows.push(row);
    }
  }
  return rows;
}

/** Insert or replace a coupon; usedCount and createdAt are server-owned. */
export function upsertCoupon(doc: CouponsDoc, coupon: Coupon): CouponsDoc {
  const clash = doc.coupons.find((c) => c.code === coupon.code && c.id !== coupon.id);
  if (clash) throw new Error(`Coupon code ${coupon.code} already exists`);
  const prev = doc.coupons.find((c) => c.id === coupon.id);
  const merged: Coupon = prev ? { ...coupon, usedCount: prev.usedCount, createdAt: prev.createdAt } : coupon;
  return {
    coupons: prev ? doc.coupons.map((c) => (c.id === coupon.id ? merged : c)) : [...doc.coupons, merged],
  };
}

export function removeCoupon(doc: CouponsDoc, id: string): CouponsDoc {
  if (!doc.coupons.some((c) => c.id === id)) throw new NotFoundError(`Coupon ${id}`);
  return { coupons: doc.coupons.filter((c) => c.id !== id) };
}

/**
 * Bulk sale pricing (A5). percentOff > 0 puts the products on sale from their
 * regular price (rounded to whole rupees); null / 0 ends the sale.
 */
export function applySale(
  doc: CatalogueDoc,
  ids: string[],
  sale: { percentOff: number; saleEndsAt?: string } | null,
  now: Date = new Date(),
): CatalogueDoc {
  const set = new Set(ids);
  const at = now.toISOString();
  return {
    ...doc,
    products: doc.products.map((p) => {
      if (!set.has(p.id)) return p;
      const regular = p.compareAtPrice && p.compareAtPrice > p.price ? p.compareAtPrice : p.price;
      if (!sale || sale.percentOff <= 0) {
        const { compareAtPrice: _c, saleEndsAt: _s, ...rest } = p;
        return { ...rest, price: regular, updatedAt: at };
      }
      const pct = Math.min(90, Math.max(1, Math.round(sale.percentOff)));
      const price = Math.round((regular * (100 - pct)) / 10000) * 100;
      return { ...p, price, compareAtPrice: regular, saleEndsAt: sale.saleEndsAt, updatedAt: at };
    }),
  };
}
