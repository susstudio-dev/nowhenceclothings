import Link from 'next/link';
import { SORT_OPTIONS, listingHref, type ListingFilters as Filters, type SortKey } from './merch';
import type { Size } from '@/lib/schemas/common';
import { cn } from '@/components/ui';

type Params = Record<string, string | string[] | undefined>;

export interface ListingFiltersProps {
  basePath: string;
  params: Params;
  filters: Filters;
  sort: SortKey;
  facets: { sizes: Size[]; colours: { name: string; hex: string }[] };
  count: number;
}

const PRICE_BANDS: { label: string; min?: string; max?: string }[] = [
  { label: 'Under ₹2,500', max: '2500' },
  { label: '₹2,500 – ₹4,000', min: '2500', max: '4000' },
  { label: 'Over ₹4,000', min: '4000' },
];

/**
 * Filters and sort as plain links (S2): work without JavaScript, are shareable,
 * and are keyboard-navigable. State lives in the URL.
 */
export function ListingFilters({ basePath, params, filters, sort, facets, count }: ListingFiltersProps) {
  const chip = (active: boolean) =>
    cn(
      'inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 border px-3 text-xs uppercase tracking-widest',
      active ? 'border-ink bg-ink text-paper' : 'border-line hover:border-ink',
    );
  const active = filters.sizes.length + filters.colours.length + (filters.minPrice != null || filters.maxPrice != null ? 1 : 0);
  const priceActive = (b: (typeof PRICE_BANDS)[number]) =>
    String((filters.minPrice ?? -100) / 100) === (b.min ?? '-1') && String((filters.maxPrice ?? -100) / 100) === (b.max ?? '-1');

  return (
    <details className="group mb-8 border-y border-line" open={active > 0}>
      <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between text-sm uppercase tracking-widest">
        <span>
          Filter &amp; sort{active > 0 && ` (${active})`}
        </span>
        <span className="text-muted normal-case tracking-normal" aria-live="polite">
          {count} {count === 1 ? 'piece' : 'pieces'}
        </span>
      </summary>
      <div className="grid gap-6 pb-6 md:grid-cols-4">
        <fieldset>
          <legend className="mb-2 text-xs uppercase tracking-widest text-muted">Size</legend>
          <div className="flex flex-wrap gap-2">
            {facets.sizes.map((s) => {
              const on = filters.sizes.includes(s);
              return (
                <Link key={s} href={listingHref(basePath, params, 'size', s, true)} className={chip(on)} aria-pressed={on} scroll={false}>
                  {s}
                </Link>
              );
            })}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-xs uppercase tracking-widest text-muted">Colour</legend>
          <div className="flex flex-wrap gap-2">
            {facets.colours.map((c) => {
              const on = filters.colours.includes(c.name.toLowerCase());
              return (
                <Link
                  key={c.name}
                  href={listingHref(basePath, params, 'colour', c.name.toLowerCase(), true)}
                  className={chip(on)}
                  aria-pressed={on}
                  scroll={false}
                >
                  <span aria-hidden className="h-3 w-3 rounded-full border border-line" style={{ backgroundColor: c.hex }} />
                  {c.name}
                </Link>
              );
            })}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-xs uppercase tracking-widest text-muted">Price</legend>
          <div className="flex flex-wrap gap-2">
            {PRICE_BANDS.map((b) => {
              const on = priceActive(b);
              const q: Params = { ...params };
              delete q.min;
              delete q.max;
              if (!on) {
                if (b.min) q.min = b.min;
                if (b.max) q.max = b.max;
              }
              return (
                <Link key={b.label} href={listingHref(basePath, q, '_', null)} className={chip(on)} aria-pressed={on} scroll={false}>
                  {b.label}
                </Link>
              );
            })}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-xs uppercase tracking-widest text-muted">Sort</legend>
          <div className="flex flex-wrap gap-2">
            {SORT_OPTIONS.map((o) => (
              <Link
                key={o.value}
                href={listingHref(basePath, params, 'sort', o.value === 'featured' ? null : o.value)}
                className={chip(sort === o.value)}
                aria-current={sort === o.value ? 'true' : undefined}
                scroll={false}
              >
                {o.label}
              </Link>
            ))}
          </div>
        </fieldset>
        {active > 0 && (
          <Link href={basePath} className="text-sm underline md:col-span-4">
            Clear all filters
          </Link>
        )}
      </div>
    </details>
  );
}
