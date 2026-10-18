// Editable form of a SizeChart for the studio. Charts store cm; the draft
// holds text in the unit being typed (inches by default, as the printed guide).
import { SizeChart } from '@/lib/schemas/catalogue';
import { SIZES, type Size } from '@/lib/schemas/common';

export type ChartUnit = 'in' | 'cm';

export interface ChartDraft {
  id: string;
  name: string;
  unit: ChartUnit;
  sizes: Size[];
  /** "Fits body chest" range per size, in `unit`; null hides the row. */
  body: Partial<Record<Size, { min: string; max: string }>> | null;
  measurements: { label: string; values: Partial<Record<Size, string>> }[];
  tolerance: string;
  modelNote: string;
  /** Guidance sections; items one per line. */
  notes: { heading: string; items: string }[];
}

/** 2 dp so inches typed at 1 dp round-trip exactly (matches size-charts.ts). */
const inToCm = (n: number) => Math.round(n * 254) / 100;
const cmToIn = (n: number) => Math.round((n / 2.54) * 10) / 10;
const show = (cm: number, unit: ChartUnit) => String(unit === 'in' ? cmToIn(cm) : Math.round(cm * 10) / 10);

export function chartToDraft(chart: SizeChart, unit: ChartUnit = 'in'): ChartDraft {
  const hasBody = chart.rows.some((r) => r.bodyChest);
  return {
    id: chart.id,
    name: chart.name,
    unit,
    sizes: SIZES.filter((s) => chart.rows.some((r) => r.size === s)),
    body: hasBody
      ? Object.fromEntries(
          chart.rows.filter((r) => r.bodyChest).map((r) => [r.size, { min: show(r.bodyChest!.min, unit), max: show(r.bodyChest!.max, unit) }]),
        )
      : null,
    measurements: chart.measurements.map((label) => ({
      label,
      values: Object.fromEntries(
        chart.rows.filter((r) => r.values[label] != null).map((r) => [r.size, show(r.values[label], unit)]),
      ),
    })),
    tolerance: chart.tolerance ?? '',
    modelNote: chart.modelNote ?? '',
    notes: (chart.notes ?? []).map((n) => ({ heading: n.heading, items: n.items.join('\n') })),
  };
}

export function blankDraft(id: string): ChartDraft {
  const sizes: Size[] = ['S', 'M', 'L', 'XL', 'XXL'];
  return {
    id,
    name: '',
    unit: 'in',
    sizes,
    body: {},
    measurements: ['Chest (garment)', 'Body length', 'Shoulder', 'Sleeve length'].map((label) => ({ label, values: {} })),
    tolerance: '±0.5" (±1 cm)',
    modelNote: '',
    notes: [],
  };
}

/** Re-express every typed number in the other unit; blanks and non-numbers stay as typed. */
export function convertDraft(d: ChartDraft, to: ChartUnit): ChartDraft {
  if (d.unit === to) return d;
  const conv = (v: string | undefined) => {
    const t = v?.trim() ?? '';
    const n = Number(t);
    if (!t || !Number.isFinite(n)) return v ?? '';
    return to === 'cm' ? show(inToCm(n), 'cm') : show(n, 'in');
  };
  const map = <T,>(o: Partial<Record<Size, T>>, f: (v: T) => T) =>
    Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v as T)])) as Partial<Record<Size, T>>;
  return {
    ...d,
    unit: to,
    body: d.body && map(d.body, (b) => ({ min: conv(b.min), max: conv(b.max) })),
    measurements: d.measurements.map((m) => ({ ...m, values: map(m.values, conv) })),
  };
}

export type DraftResult = { ok: true; chart: SizeChart } | { ok: false; error: string };

/** Validate and convert to a stored chart (cm). Blank cells are left out, not zero. */
export function draftToChart(d: ChartDraft): DraftResult {
  const fail = (error: string): DraftResult => ({ ok: false, error });
  const toCm = (n: number) => (d.unit === 'in' ? inToCm(n) : Math.round(n * 100) / 100);
  const num = (v: string | undefined, where: string): number | null | string => {
    const t = v?.trim() ?? '';
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? toCm(n) : `${where}: "${t}" is not a measurement`;
  };

  const name = d.name.trim();
  if (!name) return fail('Give the chart a name');
  const sizes = SIZES.filter((s) => d.sizes.includes(s));
  if (!sizes.length) return fail('Pick at least one size');
  const labels = d.measurements.map((m) => m.label.trim());
  if (!labels.length) return fail('Add at least one measurement');
  if (labels.some((l) => !l)) return fail('Every measurement needs a name');
  const dup = labels.find((l, i) => labels.findIndex((x) => x.toLowerCase() === l.toLowerCase()) !== i);
  if (dup) return fail(`"${dup}" is listed twice`);

  const rows: SizeChart['rows'] = [];
  for (const size of sizes) {
    const values: Record<string, number> = {};
    for (const [i, m] of d.measurements.entries()) {
      const v = num(m.values[size], `${labels[i]} ${size}`);
      if (typeof v === 'string') return fail(v);
      if (v != null) values[labels[i]] = v;
    }
    const row: SizeChart['rows'][number] = { size, values };
    const b = d.body?.[size];
    if (b && (b.min.trim() || b.max.trim())) {
      const min = num(b.min, `Body chest ${size}`);
      const max = num(b.max, `Body chest ${size}`);
      if (typeof min === 'string') return fail(min);
      if (typeof max === 'string') return fail(max);
      if (min == null || max == null) return fail(`Body chest ${size}: fill both ends of the range`);
      if (min > max) return fail(`Body chest ${size}: the first number should be the smaller`);
      row.bodyChest = { min, max };
    }
    rows.push(row);
  }

  const notes = d.notes
    .map((n) => ({ heading: n.heading.trim(), items: n.items.split('\n').map((x) => x.trim()).filter(Boolean) }))
    .filter((n) => n.heading || n.items.length);
  if (notes.some((n) => !n.heading)) return fail('Every guidance section needs a heading');

  const parsed = SizeChart.safeParse({
    id: d.id,
    name,
    measurements: labels,
    rows,
    modelNote: d.modelNote.trim(),
    ...(d.tolerance.trim() ? { tolerance: d.tolerance.trim() } : {}),
    ...(notes.length ? { notes } : {}),
  });
  return parsed.success ? { ok: true, chart: parsed.data } : fail(parsed.error.issues[0]?.message ?? 'Invalid chart');
}
