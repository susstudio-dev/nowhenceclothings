import type { SizeChart } from './schemas/catalogue';
import type { Size } from './schemas/common';

// Code-owned size charts. Charts have no admin editor yet, so the real polo
// measurements live here and replace the Phase 0 seed placeholders at read
// time (same idea as static-pages: a stored placeholder falls back to the
// default). A chart saved with real numbers always wins.

/** Inches -> cm, kept to 2 dp so cm rounds and inches round-trip to the published 1 dp. */
const cm = (inches: number) => Math.round(inches * 254) / 100;

/** Regular fit polo, garment measured flat and doubled. Source: Nowhence size guide (inches). */
const POLO_INCHES: Record<Exclude<Size, 'XS'>, { body: [number, number]; m: number[] }> = {
  S: { body: [35, 37], m: [39, 26.8, 16.9, 8.3, 13.8, 12.2, 39] },
  M: { body: [37, 39], m: [41, 27.8, 17.7, 8.5, 14.6, 12.6, 41] },
  L: { body: [39, 41], m: [43, 28.7, 18.5, 8.7, 15.4, 13.0, 43] },
  XL: { body: [41, 43], m: [45, 29.7, 19.3, 8.9, 16.2, 13.4, 45] },
  XXL: { body: [43, 45], m: [47, 30.7, 20.1, 9.1, 17.0, 13.8, 47] },
};
const POLO_MEASUREMENTS = ['Chest (garment)', 'Body length', 'Shoulder', 'Sleeve length', 'Bicep', 'Sleeve opening', 'Bottom opening (hem)'];

export const REGULAR_FIT_POLO: SizeChart = {
  id: 'chart-polo-regular',
  name: 'Regular fit polo',
  measurements: POLO_MEASUREMENTS,
  rows: (Object.keys(POLO_INCHES) as (keyof typeof POLO_INCHES)[]).map((size) => {
    const r = POLO_INCHES[size];
    return {
      size,
      values: Object.fromEntries(POLO_MEASUREMENTS.map((k, i) => [k, cm(r.m[i])])),
      bodyChest: { min: cm(r.body[0]), max: cm(r.body[1]) },
    };
  }),
  modelNote: '',
  tolerance: '±0.5" (±1 cm)',
  notes: [
    {
      heading: 'How to measure you',
      items: [
        'Chest: around the fullest part, under the arms, tape level.',
        'Shoulder: from one shoulder point to the other, across the back.',
        'Keep the tape snug, not tight. Measure over a thin T-shirt.',
      ],
    },
    {
      heading: 'Finding your fit',
      items: [
        'Regular fit: easy through the chest, clean at the shoulder.',
        'Between sizes? Size down for a closer, athletic look; size up for relaxed.',
        'Or lay a polo you already love flat and match the chest.',
      ],
    },
    {
      heading: 'Care for the embroidery',
      items: ['Machine wash cold, inside out, gentle cycle.', 'Do not bleach. Dry in shade.', 'Iron on reverse; never iron directly on the embroidery.'],
    },
  ],
};

// The Phase 0 seed charts (scripts/generate-seed.mjs). Invented numbers: never shown.
const SEED_NOTE = 'Model is 183 cm wearing M';
const SEED_SIZES: Size[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const SEED_TOPS = SEED_SIZES.map((_, i) => ({ chest: 104 + i * 6, length: 68 + i * 2, shoulder: 50 + i * 2 }));
const SEED_BOTTOMS = SEED_SIZES.map((_, i) => ({ waist: 70 + i * 5, hip: 96 + i * 5, inseam: 76 + Math.min(i, 3) }));

function matchesSeed(chart: SizeChart, values: Record<string, number>[]): boolean {
  return (
    chart.modelNote === SEED_NOTE &&
    chart.rows.length === values.length &&
    chart.rows.every((r, i) => r.size === SEED_SIZES[i] && Object.entries(values[i]).every(([k, v]) => r.values[k] === v))
  );
}

/** 'tops' / 'bottoms' when the chart is still the seed placeholder, else null. */
export function seedChartKind(chart: SizeChart): 'tops' | 'bottoms' | null {
  if (matchesSeed(chart, SEED_TOPS)) return 'tops';
  if (matchesSeed(chart, SEED_BOTTOMS)) return 'bottoms';
  return null;
}

/**
 * Stored charts with placeholders resolved: the seed tops chart becomes the
 * real polo chart (keeping its id, so products pointing at it follow), the
 * seed bottoms chart is dropped (no bottoms are sold). Never empty.
 */
export function resolveSizeCharts(stored: SizeChart[]): SizeChart[] {
  const out: SizeChart[] = [];
  for (const chart of stored) {
    const kind = seedChartKind(chart);
    if (kind === 'tops') out.push({ ...REGULAR_FIT_POLO, id: chart.id });
    else if (kind === null) out.push(chart);
  }
  return out.length ? out : [REGULAR_FIT_POLO];
}
