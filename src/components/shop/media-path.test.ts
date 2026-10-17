import { describe, expect, it } from 'vitest';
import { parseMediaPath } from './media-path';

describe('parseMediaPath', () => {
  it('accepts id/width.fmt', () => {
    expect(parseMediaPath(['abc_1', '800.avif'])).toEqual({ id: 'abc_1', width: 800, format: 'avif' });
    expect(parseMediaPath(['x', '0.png'])).toEqual({ id: 'x', width: 0, format: 'png' });
  });
  it('rejects traversal, bad formats and extra segments', () => {
    expect(parseMediaPath(['..', '800.webp'])).toBeNull();
    expect(parseMediaPath(['a', '800.svg'])).toBeNull();
    expect(parseMediaPath(['a', '0800.webp'])).toBeNull();
    expect(parseMediaPath(['a', 'b', '800.webp'])).toBeNull();
    expect(parseMediaPath(['a'])).toBeNull();
  });
});
