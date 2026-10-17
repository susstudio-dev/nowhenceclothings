// Pure variant-grid logic (A2): colours x sizes -> SKUs, preserving any
// per-variant overrides already set.
import { SIZES, type Size } from '@/lib/schemas/common';
import type { Colour, Variant } from '@/lib/schemas/catalogue';

const clean = (s: string) =>
  s.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** skuFor('tee-heavyweight', 'bone', 'M') -> 'TEE-HEAVYWEIGHT-BONE-M' (max 40 chars). */
export function skuFor(base: string, colourId: string, size: Size): string {
  const tail = `-${clean(colourId)}-${size}`;
  const head = clean(base).slice(0, Math.max(3, 40 - tail.length)).replace(/-+$/g, '') || 'SKU';
  return `${head}${tail}`.slice(0, 40);
}

/** Sizes in canonical order (XS..XXL), deduped. */
export function sortSizes(sizes: readonly Size[]): Size[] {
  return SIZES.filter((s) => sizes.includes(s));
}

/**
 * Rebuilds the full colour x size grid. Existing variants keep their SKU and
 * overrides; new cells get a generated SKU; removed colours/sizes drop out.
 */
export function buildVariantGrid(
  base: string,
  colours: Pick<Colour, 'id'>[],
  sizes: readonly Size[],
  existing: Variant[] = [],
): Variant[] {
  const byCell = new Map(existing.map((v) => [`${v.colourId}|${v.size}`, v]));
  const out: Variant[] = [];
  for (const c of colours) {
    for (const size of sortSizes(sizes)) {
      const prev = byCell.get(`${c.id}|${size}`);
      out.push(prev ? { ...prev } : { sku: skuFor(base, c.id, size), colourId: c.id, size });
    }
  }
  return out;
}

/** SKUs present before but not after (their inventory rows can be pruned). */
export function removedSkus(before: Variant[], after: Variant[]): string[] {
  const keep = new Set(after.map((v) => v.sku));
  return before.map((v) => v.sku).filter((s) => !keep.has(s));
}
