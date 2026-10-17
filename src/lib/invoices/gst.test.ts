import { describe, expect, it } from 'vitest';
import {
  allocate,
  amountInWords,
  financialYear,
  formatAmount,
  gstinCheckChar,
  numberToIndianWords,
  rateForUnit,
  splitInclusive,
  splitTax,
  stateCodeFromName,
  validateGstin,
} from './gst';

const SLABS = [{ upTo: 250000, ratePercent: 5 }, { ratePercent: 18 }];

describe('gst', () => {
  it('validates GSTIN format, state code and check digit', () => {
    expect(validateGstin('27AAPFU0939F1ZV')).toMatchObject({ ok: true, stateCode: '27', state: 'Maharashtra' });
    expect(validateGstin(' 27aapfu0939f1zv ')).toMatchObject({ ok: true, gstin: '27AAPFU0939F1ZV' });
    expect(validateGstin('27AAPFU0939F1ZX').ok).toBe(false);
    expect(validateGstin('99AAPFU0939F1Z' + gstinCheckChar('99AAPFU0939F1Z'))).toMatchObject({ ok: false });
    expect(validateGstin('12345').ok).toBe(false);
  });

  it('maps state names to codes', () => {
    expect(stateCodeFromName('Karnataka')).toBe('29');
    expect(stateCodeFromName('tamil nadu')).toBe('33');
    expect(stateCodeFromName('New Delhi')).toBe('07');
    expect(stateCodeFromName('Jammu & Kashmir')).toBe('01');
    expect(stateCodeFromName('Atlantis')).toBeNull();
  });

  it('labels the financial year in IST', () => {
    expect(financialYear('2025-04-01T00:00:00+05:30')).toBe('25-26');
    expect(financialYear('2025-03-31T18:29:00Z')).toBe('24-25');
    expect(financialYear('2025-03-31T18:31:00Z')).toBe('25-26');
    expect(financialYear('2026-01-15T10:00:00Z')).toBe('25-26');
  });

  it('picks the apparel slab by inclusive unit price', () => {
    expect(rateForUnit(250000, SLABS, 12)).toBe(5);
    expect(rateForUnit(250001, SLABS, 12)).toBe(18);
    expect(rateForUnit(99900, [], 12)).toBe(12);
  });

  it('back-calculates taxable value and never loses a paisa', () => {
    expect(splitInclusive(105000, 5)).toEqual({ taxable: 100000, tax: 5000 });
    expect(splitInclusive(329900, 18)).toEqual({ taxable: 279576, tax: 50324 });
    for (const g of [1, 99, 249999, 329901, 1234567]) {
      const s = splitInclusive(g, 18);
      expect(s.taxable + s.tax).toBe(g);
    }
  });

  it('splits CGST/SGST evenly with odd paise to SGST, or IGST', () => {
    expect(splitTax(50325, true)).toEqual({ cgst: 25162, sgst: 25163, igst: 0 });
    expect(splitTax(50325, false)).toEqual({ cgst: 0, sgst: 0, igst: 50325 });
  });

  it('allocates exactly by largest remainder', () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(0, [5, 5])).toEqual([0, 0]);
    const a = allocate(9999, [329900, 249900, 99900]);
    expect(a.reduce((s, v) => s + v, 0)).toBe(9999);
  });

  it('writes amounts in Indian words', () => {
    expect(numberToIndianWords(0)).toBe('Zero');
    expect(numberToIndianWords(105)).toBe('One Hundred Five');
    expect(numberToIndianWords(1234567)).toBe('Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven');
    expect(numberToIndianWords(120000000)).toBe('Twelve Crore');
    expect(amountInWords(249950)).toBe('Rupees Two Thousand Four Hundred Ninety Nine and Fifty Paise Only');
    expect(amountInWords(329900)).toBe('Rupees Three Thousand Two Hundred Ninety Nine Only');
  });

  it('formats amounts with Indian grouping', () => {
    expect(formatAmount(12345678)).toBe('1,23,456.78');
    expect(formatAmount(99900)).toBe('999.00');
    expect(formatAmount(5)).toBe('0.05');
  });
});
