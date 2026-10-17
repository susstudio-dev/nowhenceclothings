import { describe, expect, it } from 'vitest';
import { encodeQr, formatBits, qrSvg, rsDivisor, rsRemainder } from './qr';

describe('qr encoder', () => {
  it('Reed-Solomon matches the ISO 1-M "HELLO WORLD" vector', () => {
    const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
    expect(rsRemainder(data, rsDivisor(10))).toEqual([196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
  });
  it('format info for level M', () => {
    expect(formatBits(0).toString(2).padStart(15, '0')).toBe('101010000010010');
    expect(formatBits(4).toString(2).padStart(15, '0')).toBe('100010111111001');
  });
  it('picks the smallest version and draws finder + timing patterns', () => {
    const short = encodeQr('https://nowhenceclothings.com/book/x');
    expect(short.version).toBe(3);
    const url = 'https://nowhenceclothings.com/book/polo-black-ring-embroidered?code=FRIENDS-2026';
    const qr = encodeQr(url);
    expect(qr.size).toBe(qr.version * 4 + 17);
    expect(qr.version).toBe(5);
    for (const [cx, cy] of [[3, 3], [qr.size - 4, 3], [3, qr.size - 4]] as const) {
      expect(qr.modules[cy]![cx]).toBe(true); // centre
      expect(qr.modules[cy]![cx + 2]).toBe(false); // light ring
      expect(qr.modules[cy]![cx + 3]).toBe(true); // outer ring
    }
    for (let i = 8; i < qr.size - 8; i++) expect(qr.modules[6]![i]).toBe(i % 2 === 0);
    expect(qr.modules[qr.size - 8]![8]).toBe(true); // dark module
    expect(encodeQr(url)).toEqual(qr); // deterministic
  });
  it('version 7+ carries version info; long text is rejected', () => {
    expect(encodeQr('x'.repeat(130)).version).toBe(8);
    expect(() => encodeQr('x'.repeat(400))).toThrow();
  });
  it('renders SVG with a quiet zone', () => {
    const svg = qrSvg('hi');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('viewBox="0 0 29 29"');
    expect(svg).not.toContain('hi"');
  });
});
