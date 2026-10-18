'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import type { SizeChart } from '@/lib/schemas/catalogue';
import { sizeChartMatrix } from './merch';

/** Measurements down, sizes across; inches first, centimetres below (matches the printed guide). */
export function SizeChartTable({ chart }: { chart: SizeChart }) {
  const { sizes, rows } = sizeChartMatrix(chart);
  return (
    <div>
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[20rem] text-left text-small tabular-nums">
          <caption className="sr-only">{chart.name}: garment measurements in inches and centimetres, by size</caption>
          <thead>
            <tr className="border-b border-ink/30">
              <th scope="col" className="sticky left-0 z-[1] w-[6.5rem] bg-paper py-3 pr-2 text-label font-normal uppercase text-muted sm:w-auto sm:pr-3">
                Measurement
              </th>
              {sizes.map((s) => (
                <th key={s} scope="col" className="py-3 pl-2 text-right font-medium sm:pl-3">
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className={'border-b border-line' + (r.body ? ' bg-paper-deep' : '')}>
                <th scope="row" className={'sticky left-0 z-[1] py-3 pr-2 align-top text-caption font-normal sm:pr-3 sm:text-small ' + (r.body ? 'bg-paper-deep' : 'bg-paper')}>
                  <span className={r.body ? 'text-clay' : ''}>{r.label}</span>
                  {r.hint && <span className="block text-caption text-muted">{r.hint}</span>}
                </th>
                {r.cells.map((c, i) => (
                  <td key={sizes[i]} className="whitespace-nowrap py-3 pl-2 text-right align-top sm:pl-3">
                    {c ? (
                      <>
                        <span className="block text-ink">{c.inches}</span>
                        <span className="block text-[0.6875rem] text-muted sm:text-caption">{c.cm}</span>
                      </>
                    ) : (
                      <span className="text-muted">–</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sizes.length > 3 && (
        <p aria-hidden className="mt-2 text-caption text-muted sm:hidden">
          Swipe the table for {sizes.slice(-2).join(' and ')} →
        </p>
      )}
      <p className="mt-4 text-caption text-muted">
        Garment measurements, taken flat and doubled. Unisex fit.
        {chart.tolerance ? ` Measurements may vary by ${chart.tolerance}.` : ''}
        {chart.modelNote ? ` ${chart.modelNote}.` : ''}
      </p>
    </div>
  );
}

/** How to measure, fit and care, from the chart. */
export function SizeChartNotes({ chart, className }: { chart: SizeChart; className?: string }) {
  if (!chart.notes?.length) return null;
  return (
    <div className={'grid gap-8 sm:grid-cols-3 ' + (className ?? '')}>
      {chart.notes.map((n) => (
        <section key={n.heading}>
          <h3 className="eyebrow text-clay">{n.heading}</h3>
          <ul className="mt-3 space-y-2 text-small text-ink-soft">
            {n.items.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** "Size guide" link that opens the chart in a sheet (S3). */
export function SizeGuide({ chart }: { chart: SizeChart }) {
  const [open, setOpen] = useState(false);
  const measure = chart.notes?.find((n) => /measure/i.test(n.heading));
  const fit = chart.notes?.find((n) => /fit/i.test(n.heading));
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="link-underline text-caption text-ink-soft">
        Size guide
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Size guide">
        <p className="mb-6 text-small text-muted">{chart.name}. Find your chest in the first row.</p>
        <SizeChartTable chart={chart} />
        {(measure || fit) && (
          <div className="mt-8 space-y-6">
            {[measure, fit].filter((n): n is NonNullable<typeof n> => !!n).map((n) => (
              <section key={n.heading}>
                <h3 className="eyebrow text-clay">{n.heading}</h3>
                <ul className="mt-3 space-y-2 text-small text-ink-soft">
                  {n.items.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
        <p className="mt-8 text-small">
          <Link href="/size-guide" className="link-underline">Full size guide and care</Link>
        </p>
      </Sheet>
    </>
  );
}
