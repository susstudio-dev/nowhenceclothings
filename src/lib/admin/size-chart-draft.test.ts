import { describe, expect, it } from 'vitest';
import { REGULAR_FIT_POLO } from '@/lib/size-charts';
import { blankDraft, chartToDraft, convertDraft, draftToChart, type ChartDraft } from './size-chart-draft';

const ok = (d: ChartDraft) => {
  const r = draftToChart(d);
  if (!r.ok) throw new Error(r.error);
  return r.chart;
};
const err = (d: ChartDraft) => {
  const r = draftToChart(d);
  return r.ok ? null : r.error;
};

describe('size chart draft', () => {
  it('round-trips the polo chart through inches unchanged', () => {
    const d = chartToDraft(REGULAR_FIT_POLO);
    expect(d.measurements[0].values.M).toBe('41');
    expect(d.body?.M).toEqual({ min: '37', max: '39' });
    expect(ok(d)).toEqual(REGULAR_FIT_POLO);
  });

  it('converts typed values between inches and cm', () => {
    const cm = convertDraft(chartToDraft(REGULAR_FIT_POLO), 'cm');
    expect(cm.unit).toBe('cm');
    expect(cm.measurements[0].values.M).toBe('104.1');
    const back = convertDraft(cm, 'in');
    expect(back.measurements[0].values.M).toBe('41');
    expect(ok(back)).toEqual(REGULAR_FIT_POLO);
  });

  it('stores cm as typed when entering in cm', () => {
    const d = { ...blankDraft('c1'), name: 'Tee', unit: 'cm' as const, sizes: ['M' as const], body: null };
    d.measurements = [{ label: 'Chest', values: { M: '104' } }];
    expect(ok(d).rows).toEqual([{ size: 'M', values: { Chest: 104 } }]);
  });

  it('leaves blank cells out instead of zero, and keeps sizes in S–XXL order', () => {
    const d = { ...blankDraft('c1'), name: 'Tee', sizes: ['L' as const, 'S' as const], body: null };
    d.measurements = [{ label: 'Chest', values: { S: '39' } }];
    const c = ok(d);
    expect(c.rows.map((r) => r.size)).toEqual(['S', 'L']);
    expect(c.rows[1].values).toEqual({});
  });

  it('drops empty guidance sections and splits items by line', () => {
    const d = { ...blankDraft('c1'), name: 'Tee', notes: [{ heading: 'Care', items: 'Wash cold\n\n Dry in shade ' }, { heading: '', items: '' }] };
    expect(ok(d).notes).toEqual([{ heading: 'Care', items: ['Wash cold', 'Dry in shade'] }]);
  });

  it('explains what is wrong', () => {
    const base = { ...blankDraft('c1'), name: 'Tee' };
    expect(err({ ...base, name: ' ' })).toMatch(/name/);
    expect(err({ ...base, sizes: [] })).toMatch(/size/);
    expect(err({ ...base, measurements: [{ label: 'Chest', values: {} }, { label: 'chest', values: {} }] })).toMatch(/twice/);
    expect(err({ ...base, measurements: [{ label: 'Chest', values: { M: 'big' } }] })).toMatch(/Chest M: "big"/);
    expect(err({ ...base, body: { M: { min: '39', max: '' } } })).toMatch(/both ends/);
    expect(err({ ...base, body: { M: { min: '41', max: '39' } } })).toMatch(/smaller/);
    expect(err({ ...base, notes: [{ heading: '', items: 'x' }] })).toMatch(/heading/);
  });
});
