import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CatalogueDoc, SizeChart } from './schemas/catalogue';
import { REGULAR_FIT_POLO, resolveSizeCharts, seedChartKind } from './size-charts';

const seed = CatalogueDoc.parse(JSON.parse(readFileSync('data/catalogue.json', 'utf8')));
const inches = (cm: number) => Math.round((cm / 2.54) * 10) / 10;

describe('REGULAR_FIT_POLO', () => {
  it('is a valid chart', () => {
    expect(SizeChart.parse(REGULAR_FIT_POLO)).toEqual(REGULAR_FIT_POLO);
  });

  it('reproduces the published guide in both units', () => {
    const m = REGULAR_FIT_POLO.rows.find((r) => r.size === 'M')!;
    expect(inches(m.values['Chest (garment)'])).toBe(41);
    expect(Math.round(m.values['Chest (garment)'])).toBe(104);
    expect(inches(m.values['Body length'])).toBe(27.8);
    expect(Math.round(m.values['Body length'])).toBe(71);
    expect(inches(m.values['Sleeve length'])).toBe(8.5);
    expect([inches(m.bodyChest!.min), inches(m.bodyChest!.max)]).toEqual([37, 39]);
    expect([Math.round(m.bodyChest!.min), Math.round(m.bodyChest!.max)]).toEqual([94, 99]);
    const xxl = REGULAR_FIT_POLO.rows.find((r) => r.size === 'XXL')!;
    expect(inches(xxl.values['Bicep'])).toBe(17);
    expect(Math.round(xxl.values['Bottom opening (hem)'])).toBe(119);
  });

  it('covers S to XXL', () => {
    expect(REGULAR_FIT_POLO.rows.map((r) => r.size)).toEqual(['S', 'M', 'L', 'XL', 'XXL']);
  });
});

describe('resolveSizeCharts', () => {
  it('recognises the seed placeholders', () => {
    expect(seed.sizeCharts.map(seedChartKind)).toEqual(['tops', 'bottoms']);
    expect(seedChartKind(REGULAR_FIT_POLO)).toBeNull();
  });

  it('swaps seed tops for the polo chart under the same id and drops seed bottoms', () => {
    const out = resolveSizeCharts(seed.sizeCharts);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ ...REGULAR_FIT_POLO, id: 'chart-tops' });
  });

  it('keeps real charts as stored', () => {
    const real: SizeChart = { id: 'c', name: 'Real', measurements: ['chest'], rows: [{ size: 'M', values: { chest: 100 } }], modelNote: '' };
    expect(resolveSizeCharts([real])).toEqual([real]);
  });

  it('is never empty', () => {
    expect(resolveSizeCharts([])).toEqual([REGULAR_FIT_POLO]);
  });
});
