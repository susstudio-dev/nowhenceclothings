'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SizeChart } from '@/lib/schemas/catalogue';
import { SIZES, type Size } from '@/lib/schemas/common';
import { blankDraft, chartToDraft, convertDraft, draftToChart, type ChartDraft, type ChartUnit } from '@/lib/admin/size-chart-draft';
import { SizeChartTable } from '@/components/shop/SizeGuide';
import { Button, Input, cn } from '@/components/ui';
import { adminFetch } from './api-client';
import { EmptyState, Panel, Table, fieldLabel, td, th, tr } from './kit';
import { useMsgToast } from './useMsgToast';

const newId = () => `chart-${Date.now().toString(36)}`;
const cellBase = 'h-8 w-full border border-line bg-paper px-2 text-sm text-ink placeholder:text-muted/50 focus:border-ink focus:outline-none';
const cell = cn(cellBase, 'min-w-[3.25rem] text-right tabular-nums');
const iconBtn = 'inline-flex h-8 w-7 items-center justify-center text-muted transition-colors hover:text-ink disabled:opacity-30 disabled:hover:text-muted';

export function SizeChartsEditor({ charts, usage }: { charts: SizeChart[]; usage: Record<string, string[]> }) {
  const router = useRouter();
  const [draft, setDraft] = useState<ChartDraft | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useMsgToast(msg);

  const open = (d: ChartDraft, fresh: boolean) => {
    setDraft(d);
    setIsNew(fresh);
    setMsg(null);
  };

  async function save() {
    if (!draft) return;
    const r = draftToChart(draft);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setBusy(true);
    try {
      await adminFetch('/api/admin/size-charts', { method: 'PUT', body: { chart: r.chart } });
      setMsg({ ok: true, text: `Saved ${r.chart.name}` });
      setDraft(null);
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: SizeChart) {
    if (!window.confirm(`Delete the size chart "${c.name}"?`)) return;
    try {
      await adminFetch(`/api/admin/size-charts/${encodeURIComponent(c.id)}`, { method: 'DELETE' });
      setMsg({ ok: true, text: `Deleted ${c.name}` });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Delete failed' });
    }
  }

  if (draft) return <ChartForm draft={draft} setDraft={setDraft} isNew={isNew} busy={busy} onSave={save} onCancel={() => setDraft(null)} usedBy={usage[draft.id] ?? []} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="secondary" onClick={() => open(blankDraft(newId()), true)}>
          New chart
        </Button>
      </div>
      {charts.length === 0 ? (
        <EmptyState title="No size charts yet">Create one, then pick it on each product.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={th}>Chart</th>
              <th className={th}>Sizes</th>
              <th className={th}>Measurements</th>
              <th className={th}>Used by</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {charts.map((c) => {
              const used = usage[c.id] ?? [];
              return (
                <tr key={c.id} className={tr}>
                  <td className={td}>
                    <button type="button" onClick={() => open(chartToDraft(c), false)} className="text-left font-medium text-ink hover:underline">
                      {c.name}
                    </button>
                  </td>
                  <td className={cn(td, 'tabular-nums text-muted')}>{c.rows.map((r) => r.size).join(' · ')}</td>
                  <td className={cn(td, 'text-muted')}>{c.measurements.length}</td>
                  <td className={cn(td, 'text-muted')} title={used.join(', ')}>
                    {used.length ? `${used.length} product${used.length === 1 ? '' : 's'}` : 'Not used'}
                  </td>
                  <td className={cn(td, 'whitespace-nowrap text-right text-xs')}>
                    <button type="button" className="text-ink hover:underline" onClick={() => open(chartToDraft(c), false)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="ml-4 text-ink hover:underline"
                      onClick={() => open({ ...chartToDraft(c), id: newId(), name: `${c.name} copy` }, true)}
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      className="ml-4 text-sale hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
                      disabled={used.length > 0}
                      title={used.length ? 'Move its products to another chart first' : undefined}
                      onClick={() => remove(c)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}

function ChartForm({
  draft: d,
  setDraft,
  isNew,
  busy,
  usedBy,
  onSave,
  onCancel,
}: {
  draft: ChartDraft;
  setDraft: (fn: (d: ChartDraft | null) => ChartDraft | null) => void;
  isNew: boolean;
  busy: boolean;
  usedBy: string[];
  onSave: () => void;
  onCancel: () => void;
}) {
  const patch = (p: Partial<ChartDraft>) => setDraft((cur) => (cur ? { ...cur, ...p } : cur));
  const sizes = SIZES.filter((s) => d.sizes.includes(s));
  const result = useMemo(() => draftToChart(d), [d]);
  const unitMark = d.unit === 'in' ? '"' : 'cm';

  const setValue = (i: number, size: Size, v: string) =>
    patch({ measurements: d.measurements.map((m, j) => (j === i ? { ...m, values: { ...m.values, [size]: v } } : m)) });
  const setBody = (size: Size, end: 'min' | 'max', v: string) => {
    const cur = d.body?.[size] ?? { min: '', max: '' };
    patch({ body: { ...d.body, [size]: { ...cur, [end]: v } } });
  };
  const moveRow = (i: number, by: -1 | 1) => {
    const list = [...d.measurements];
    const j = i + by;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    patch({ measurements: list });
  };

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <div className="space-y-6">
        <Panel title={isNew ? 'New size chart' : 'Edit size chart'} description={
            usedBy.length ? `Used by ${usedBy.slice(0, 4).join(', ')}${usedBy.length > 4 ? ` and ${usedBy.length - 4} more` : ''}` : undefined
          }>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Name" required value={d.name} placeholder="Regular fit polo" onChange={(e) => patch({ name: e.target.value })} />
            <Input label="Tolerance" value={d.tolerance} placeholder={'±0.5" (±1 cm)'} onChange={(e) => patch({ tolerance: e.target.value })} />
            <Input
              label="Model note"
              className="sm:col-span-2"
              value={d.modelNote}
              placeholder="Model is 183 cm wearing M"
              onChange={(e) => patch({ modelNote: e.target.value })}
            />
          </div>
        </Panel>

        <Panel
          title="Measurements"
          description="Garment measured flat and doubled. Leave a cell blank to show a dash."
          actions={
            <div role="radiogroup" aria-label="Unit" className="flex border border-line">
              {(['in', 'cm'] as ChartUnit[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  role="radio"
                  aria-checked={d.unit === u}
                  onClick={() => setDraft((cur) => (cur ? convertDraft(cur, u) : cur))}
                  className={cn('h-7 px-3 text-[11px] uppercase tracking-label', d.unit === u ? 'bg-ink text-paper' : 'text-muted hover:text-ink')}
                >
                  {u === 'in' ? 'Inches' : 'cm'}
                </button>
              ))}
            </div>
          }
        >
          <fieldset className="mb-5">
            <legend className={cn(fieldLabel, 'mb-2')}>Sizes</legend>
            <div className="flex flex-wrap gap-2">
              {SIZES.map((s) => {
                const on = d.sizes.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() => patch({ sizes: on ? d.sizes.filter((x) => x !== s) : [...d.sizes, s] })}
                    className={cn('h-8 min-w-[2.75rem] border px-3 text-xs', on ? 'border-ink bg-ink text-paper' : 'border-line text-muted hover:border-ink hover:text-ink')}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full border-separate border-spacing-x-1 border-spacing-y-1 text-sm">
              <thead>
                <tr>
                  <th className={cn(fieldLabel, 'min-w-[11rem] text-left font-medium')}>Measurement ({unitMark})</th>
                  {sizes.map((s) => (
                    <th key={s} className="text-right text-xs font-medium">
                      {s}
                    </th>
                  ))}
                  <th className="w-[5.25rem]" />
                </tr>
              </thead>
              <tbody>
                {d.body && (
                  <tr>
                    <td className="align-top">
                      <p className="pt-1.5 text-sm text-clay">Fits body chest</p>
                      <p className="text-xs text-muted">range, on the person</p>
                    </td>
                    {sizes.map((s) => (
                      <td key={s} className="align-top">
                        <input
                          aria-label={`Body chest ${s} from`}
                          inputMode="decimal"
                          className={cell}
                          placeholder="min"
                          value={d.body?.[s]?.min ?? ''}
                          onChange={(e) => setBody(s, 'min', e.target.value)}
                        />
                        <input
                          aria-label={`Body chest ${s} to`}
                          inputMode="decimal"
                          className={cn(cell, 'mt-1')}
                          placeholder="max"
                          value={d.body?.[s]?.max ?? ''}
                          onChange={(e) => setBody(s, 'max', e.target.value)}
                        />
                      </td>
                    ))}
                    <td className="align-top">
                      <button type="button" className={cn(iconBtn, 'w-auto px-1 text-xs')} onClick={() => patch({ body: null })}>
                        Hide
                      </button>
                    </td>
                  </tr>
                )}
                {d.measurements.map((m, i) => (
                  <tr key={i}>
                    <td>
                      <input
                        aria-label={`Measurement ${i + 1} name`}
                        className={cellBase}
                        value={m.label}
                        placeholder="Measurement"
                        onChange={(e) => patch({ measurements: d.measurements.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
                      />
                    </td>
                    {sizes.map((s) => (
                      <td key={s}>
                        <input
                          aria-label={`${m.label || 'Measurement'} ${s}`}
                          inputMode="decimal"
                          className={cell}
                          value={m.values[s] ?? ''}
                          onChange={(e) => setValue(i, s, e.target.value)}
                        />
                      </td>
                    ))}
                    <td className="whitespace-nowrap">
                      <button type="button" aria-label="Move up" className={iconBtn} disabled={i === 0} onClick={() => moveRow(i, -1)}>
                        ↑
                      </button>
                      <button type="button" aria-label="Move down" className={iconBtn} disabled={i === d.measurements.length - 1} onClick={() => moveRow(i, 1)}>
                        ↓
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${m.label || 'measurement'}`}
                        className={iconBtn}
                        onClick={() => patch({ measurements: d.measurements.filter((_, j) => j !== i) })}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs">
            <button type="button" className="text-ink hover:underline" onClick={() => patch({ measurements: [...d.measurements, { label: '', values: {} }] })}>
              + Add measurement
            </button>
            {!d.body && (
              <button type="button" className="text-ink hover:underline" onClick={() => patch({ body: {} })}>
                + Add “Fits body chest” row
              </button>
            )}
          </div>
        </Panel>

        <Panel title="Preview" description="As customers see it in the size guide. Updates as you type.">
          {result.ok ? <SizeChartTable chart={result.chart} /> : <p className="text-sm text-muted">{result.error}</p>}
        </Panel>

        <Panel title="Guidance" description="How to measure, fit and care. Shown under the chart; one point per line.">
          <div className="space-y-5">
            {d.notes.map((n, i) => (
              <div key={i} className="grid gap-2 border-b border-line pb-5 last:border-0 last:pb-0">
                <div className="flex items-end gap-2">
                  <Input
                    label="Heading"
                    className="flex-1"
                    value={n.heading}
                    placeholder="How to measure you"
                    onChange={(e) => patch({ notes: d.notes.map((x, j) => (j === i ? { ...x, heading: e.target.value } : x)) })}
                  />
                  <Button variant="ghost" size="sm" onClick={() => patch({ notes: d.notes.filter((_, j) => j !== i) })}>
                    Remove
                  </Button>
                </div>
                <textarea
                  aria-label={`${n.heading || 'Section'} points`}
                  rows={3}
                  className="w-full border border-line bg-paper px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
                  value={n.items}
                  onChange={(e) => patch({ notes: d.notes.map((x, j) => (j === i ? { ...x, items: e.target.value } : x)) })}
                />
              </div>
            ))}
            <button type="button" className="text-xs text-ink hover:underline" onClick={() => patch({ notes: [...d.notes, { heading: '', items: '' }] })}>
              + Add section
            </button>
          </div>
        </Panel>
      </div>


      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <Button type="submit" loading={busy} disabled={!result.ok}>
          {isNew ? 'Create chart' : 'Save chart'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        {!result.ok && <p className="text-xs text-muted">{result.error}</p>}
      </div>
    </form>
  );
}
