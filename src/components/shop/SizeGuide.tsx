'use client';
import { useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import type { SizeChart } from '@/lib/schemas/catalogue';
import { sizeChartTable } from './merch';

export function SizeChartTable({ chart }: { chart: SizeChart }) {
  const [unit, setUnit] = useState<'cm' | 'in'>('cm');
  const rows = sizeChartTable(chart, unit);
  return (
    <div>
      <div role="group" aria-label="Units" className="mb-3 flex gap-2">
        {(['cm', 'in'] as const).map((u) => (
          <button
            key={u}
            type="button"
            aria-pressed={unit === u}
            onClick={() => setUnit(u)}
            className={'min-h-[40px] min-w-[48px] border px-3 text-label uppercase transition-colors duration-fast ' + (unit === u ? 'border-ink bg-ink text-paper' : 'border-line hover:border-ink')}
          >
            {u}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-small tabular-nums">
          <caption className="sr-only">
            {chart.name}, measurements in {unit === 'cm' ? 'centimetres' : 'inches'}
          </caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="py-3 pr-4 text-label font-normal uppercase text-muted">Size</th>
              {chart.measurements.map((m) => (
                <th key={m} scope="col" className="py-3 pr-4 text-label font-normal uppercase text-muted">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.size} className="border-b border-line">
                <th scope="row" className="py-3 pr-4 font-medium">{r.size}</th>
                {r.values.map((v, i) => (
                  <td key={i} className="py-3 pr-4">{v ?? '–'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-caption text-muted">
        Garment measurements, laid flat. Unisex fit{chart.modelNote ? ` · ${chart.modelNote}` : ''}.
      </p>
    </div>
  );
}

/** "Size guide" link that opens the chart in a sheet (S3). */
export function SizeGuide({ chart }: { chart: SizeChart }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="link-underline text-caption text-ink-soft">
        Size guide
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Size guide">
        <p className="mb-6 text-small text-muted">{chart.name}</p>
        <SizeChartTable chart={chart} />
      </Sheet>
    </>
  );
}
