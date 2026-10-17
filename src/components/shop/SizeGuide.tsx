'use client';
import { useState } from 'react';
import { Button, Dialog } from '@/components/ui';
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
            className={'min-h-[44px] min-w-[44px] border px-3 text-xs uppercase ' + (unit === u ? 'border-ink bg-ink text-paper' : 'border-line')}
          >
            {u}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm tabular-nums">
          <caption className="sr-only">
            {chart.name}, measurements in {unit === 'cm' ? 'centimetres' : 'inches'}
          </caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="py-2 pr-4">Size</th>
              {chart.measurements.map((m) => (
                <th key={m} scope="col" className="py-2 pr-4 capitalize">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.size} className="border-b border-line">
                <th scope="row" className="py-2 pr-4">{r.size}</th>
                {r.values.map((v, i) => (
                  <td key={i} className="py-2 pr-4">{v ?? '–'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">
        Garment measurements, laid flat. Unisex fit{chart.modelNote ? ` · ${chart.modelNote}` : ''}.
      </p>
    </div>
  );
}

/** "Size guide" link that opens the chart in a dialog (S3). */
export function SizeGuide({ chart }: { chart: SizeChart }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="link" size="sm" onClick={() => setOpen(true)}>
        Size guide
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Size guide" description={chart.name}>
        <SizeChartTable chart={chart} />
        <Button variant="secondary" className="mt-4" onClick={() => setOpen(false)}>
          Close
        </Button>
      </Dialog>
    </>
  );
}
