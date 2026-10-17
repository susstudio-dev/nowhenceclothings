// Pure merchandising helpers for the storefront (no server imports; unit-tested
// in merch.test.ts). Shared by server pages and client components.
import type { Drop, Product, SizeChart, Variant } from '@/lib/schemas/catalogue';
import type { InventoryDoc } from '@/lib/schemas/inventory';
import { SIZES, type Size } from '@/lib/schemas/common';

export type SortKey = 'featured' | 'new' | 'price-asc' | 'price-desc';
export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'featured', label: 'Featured' },
  { value: 'new', label: 'Newest' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
];

export interface ListingFilters {
  sizes: Size[];
  /** Colour names, lower-case. */
  colours: string[];
  /** Paise. */
  minPrice?: number;
  /** Paise. */
  maxPrice?: number;
}

/** Effective price + strike-through for a variant (or the product base). */
export function variantPrice(p: Product, v?: Variant, now: Date = new Date()): { amount: number; compareAt?: number } {
  const amount = v?.priceOverride ?? p.price;
  const cmp = v?.compareAtPriceOverride ?? p.compareAtPrice;
  const live = !p.saleEndsAt || new Date(p.saleEndsAt).getTime() > now.getTime();
  return cmp != null && cmp > amount && live ? { amount, compareAt: cmp } : { amount };
}

/** Lowest price across variants (listing "from" price and price filters). */
export function minPrice(p: Product): number {
  return Math.min(p.price, ...p.variants.map((v) => v.priceOverride ?? p.price));
}

export function stockOf(inv: InventoryDoc, sku: string): number {
  const l = inv[sku];
  return l ? Math.max(0, l.stock) : 0;
}

export function isSoldOut(p: Product, inv: InventoryDoc): boolean {
  return p.variants.every((v) => stockOf(inv, v.sku) === 0);
}

/** Per-SKU stock map for one product (passed to the client size selector). */
export function stockMap(p: Product, inv: InventoryDoc): Record<string, number> {
  return Object.fromEntries(p.variants.map((v) => [v.sku, stockOf(inv, v.sku)]));
}

type Params = Record<string, string | string[] | undefined>;

/** Parse URL search params into filters + sort. Unknown values are dropped. Prices in rupees. */
export function parseListingParams(sp: Params): { filters: ListingFilters; sort: SortKey } {
  const list = (k: string) => {
    const v = sp[k];
    const arr = Array.isArray(v) ? v : v ? [v] : [];
    return arr.flatMap((x) => x.split(',')).map((x) => x.trim()).filter(Boolean);
  };
  const rupees = (k: string) => {
    const raw = sp[k];
    const v = Array.isArray(raw) ? raw[0] : raw;
    if (v == null || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined;
  };
  const sizes = list('size')
    .map((s) => s.toUpperCase())
    .filter((s): s is Size => (SIZES as readonly string[]).includes(s));
  const colours = list('colour').map((c) => c.toLowerCase());
  const rawSort = Array.isArray(sp.sort) ? sp.sort[0] : sp.sort;
  const sort = SORT_OPTIONS.some((o) => o.value === rawSort) ? (rawSort as SortKey) : 'featured';
  return { filters: { sizes, colours, minPrice: rupees('min'), maxPrice: rupees('max') }, sort };
}

/**
 * Filter products. A size filter matches products with that size in stock;
 * without one, sold-out products stay visible (S2).
 */
export function filterProducts(products: Product[], inv: InventoryDoc, f: ListingFilters): Product[] {
  return products.filter((p) => {
    if (f.sizes.length && !p.variants.some((v) => f.sizes.includes(v.size) && stockOf(inv, v.sku) > 0)) return false;
    if (f.colours.length && !p.colours.some((c) => f.colours.includes(c.name.toLowerCase()))) return false;
    const price = minPrice(p);
    if (f.minPrice != null && price < f.minPrice) return false;
    if (f.maxPrice != null && price > f.maxPrice) return false;
    return true;
  });
}

/** Stable sort. When `inv` is given, sold-out items sink to the end (still visible). */
export function sortProducts(products: Product[], sort: SortKey, inv?: InventoryDoc): Product[] {
  const cmp = (a: Product, b: Product): number => {
    switch (sort) {
      case 'new':
        return b.createdAt.localeCompare(a.createdAt);
      case 'price-asc':
        return minPrice(a) - minPrice(b);
      case 'price-desc':
        return minPrice(b) - minPrice(a);
      default:
        return a.sortOrder - b.sortOrder;
    }
  };
  return products
    .map((p, i) => ({ p, i, out: inv ? (isSoldOut(p, inv) ? 1 : 0) : 0 }))
    .sort((a, b) => a.out - b.out || cmp(a.p, b.p) || a.i - b.i)
    .map((x) => x.p);
}

/** Facets available to filter on, derived from the product set. */
export function facets(products: Product[]): { sizes: Size[]; colours: { name: string; hex: string }[] } {
  const sizes = new Set<Size>();
  const colours = new Map<string, { name: string; hex: string }>();
  for (const p of products) {
    p.sizes.forEach((s) => sizes.add(s));
    for (const c of p.colours) if (!colours.has(c.name.toLowerCase())) colours.set(c.name.toLowerCase(), { name: c.name, hex: c.hex });
  }
  return { sizes: SIZES.filter((s) => sizes.has(s)), colours: [...colours.values()] };
}

// ---- search (S10, client-side) ----

export interface SearchEntry {
  slug: string;
  title: string;
  price: number;
  image?: Product['colours'][number]['images'][number];
  haystack: string;
}

function norm(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function buildSearchIndex(products: Product[], categoryNames: Record<string, string> = {}): SearchEntry[] {
  return products.map((p) => ({
    slug: p.slug,
    title: p.title,
    price: minPrice(p),
    image: p.colours[0]?.images[0],
    haystack: norm([p.title, p.description, p.fabric, p.fit, categoryNames[p.categoryId] ?? '', ...p.colours.map((c) => c.name)].join(' ')),
  }));
}

/** Every query token must match; title-prefix hits rank above title hits above body hits. */
export function searchIndex(index: SearchEntry[], query: string, limit = 24): SearchEntry[] {
  const tokens = norm(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const scored: { e: SearchEntry; score: number; i: number }[] = [];
  index.forEach((e, i) => {
    const title = norm(e.title);
    let score = 0;
    for (const tok of tokens) {
      if (!e.haystack.includes(tok)) return;
      score += title.split(/\s+/).some((w) => w.startsWith(tok)) ? 3 : title.includes(tok) ? 2 : 1;
    }
    scored.push({ e, score, i });
  });
  return scored
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.e);
}

// ---- size guide ----

export function cmToIn(cm: number): number {
  return Math.round((cm / 2.54) * 10) / 10;
}

export function sizeChartTable(chart: SizeChart, unit: 'cm' | 'in'): { size: Size; values: (number | null)[] }[] {
  return chart.rows.map((r) => ({
    size: r.size,
    values: chart.measurements.map((m) => {
      const v = r.values[m];
      return v == null ? null : unit === 'cm' ? v : cmToIn(v);
    }),
  }));
}

// ---- drops (S4) ----

export function countdownParts(target: Date, now: Date) {
  const ms = Math.max(0, target.getTime() - now.getTime());
  const s = Math.floor(ms / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    done: ms === 0,
  };
}

export function dropFor(p: Product, drops: Drop[]): Drop | undefined {
  return p.dropId ? drops.find((d) => d.id === p.dropId) : undefined;
}

/** "Complete the look": explicit relatedIds first, then other categories from a shared collection. */
export function completeTheLook(p: Product, all: Product[], limit = 4): Product[] {
  const byId = new Map(all.map((x) => [x.id, x]));
  const out: Product[] = [];
  for (const id of p.relatedIds) {
    const r = byId.get(id);
    if (r && r.id !== p.id && r.status === 'active' && !out.includes(r)) out.push(r);
  }
  for (const r of all) {
    if (out.length >= limit) break;
    if (r.id === p.id || out.includes(r) || r.status !== 'active') continue;
    if (r.categoryId !== p.categoryId && r.collectionIds.some((c) => p.collectionIds.includes(c))) out.push(r);
  }
  return out.slice(0, limit);
}

/** Build a listing href keeping current params, toggling/setting one key. */
export function listingHref(base: string, sp: Params, key: string, value: string | null, toggle = false): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v == null || k === key) continue;
    (Array.isArray(v) ? v : [v]).forEach((x) => q.append(k, x));
  }
  if (value != null) {
    if (toggle) {
      const cur = new Set(
        [sp[key]].flat().filter((x): x is string => !!x).flatMap((x) => x.split(',')),
      );
      if (cur.has(value)) cur.delete(value);
      else cur.add(value);
      if (cur.size) q.set(key, [...cur].join(','));
    } else q.set(key, value);
  }
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}
