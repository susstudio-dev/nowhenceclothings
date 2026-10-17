import Link from 'next/link';
import { SORT_OPTIONS, listingHref, type ListingFilters as Filters, type SortKey } from './merch';
import type { Size } from '@/lib/schemas/common';
import { cn } from '@/components/ui';
import { FilterSheet } from './FilterSheet';

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
      'inline-flex min-h-[40px] min-w-[44px] items-center justify-center gap-2 border px-3 text-caption transition-colors duration-fast',
      active ? 'border-ink bg-ink text-paper' : 'border-line hover:border-ink',
    );
  const active = filters.sizes.length + filters.colours.length + (filters.minPrice != null || filters.maxPrice != null ? 1 : 0);
  const priceActive = (b: (typeof PRICE_BANDS)[number]) =>
    String((filters.minPrice ?? -100) / 100) === (b.min ?? '-1') && String((filters.maxPrice ?? -100) / 100) === (b.max ?? '-1');

  const body = (
      <div className="space-y-8">
        <fieldset>
          <legend className="mb-3 text-label uppercase text-muted">Size</legend>
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
          <legend className="mb-3 text-label uppercase text-muted">Colour</legend>
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
          <legend className="mb-3 text-label uppercase text-muted">Price</legend>
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
          <legend className="mb-3 text-label uppercase text-muted">Sort</legend>
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
      </div>
  );
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label;
  return (
    <div className="mb-8 flex items-center justify-between gap-4 border-y border-line md:mb-10">
      <FilterSheet
        label={`Filter & sort${active > 0 ? ` (${active})` : ''}`}
        footer={
          <div className="flex items-center justify-between gap-4">
            {active > 0 ? <Link href={basePath} className="link-underline text-label uppercase">Clear all</Link> : <span />}
            <span className="text-caption text-muted">{count} {count === 1 ? 'piece' : 'pieces'}</span>
          </div>
        }
      >
        {body}
      </FilterSheet>
      <p className="text-caption text-muted" aria-live="polite">
        {sort !== 'featured' && sortLabel ? `${sortLabel} · ` : ''}
        {count} {count === 1 ? 'piece' : 'pieces'}
      </p>
    </div>
  );
}
