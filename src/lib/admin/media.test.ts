import { describe, expect, it } from 'vitest';
import { MediaRef } from '@/lib/schemas/common';
import { newMediaId, parseVariantField, sniffImage, targetWidths } from './media';
import { changedSections, isContentVersionKey, versionTime } from './content';
import { SiteContentDoc } from '@/lib/schemas/site-content';

const bytes = (...xs: (number | string)[]) =>
  new Uint8Array(xs.flatMap((x) => (typeof x === 'string' ? [...x].map((c) => c.charCodeAt(0)) : [x])));

describe('media', () => {
  it('sniffs formats from magic bytes', () => {
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpg');
    expect(sniffImage(bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a))).toBe('png');
    expect(sniffImage(bytes('RIFF', 0, 0, 0, 0, 'WEBPVP8 '))).toBe('webp');
    expect(sniffImage(bytes(0, 0, 0, 0x1c, 'ftypavif', 0, 0))).toBe('avif');
    expect(sniffImage(bytes('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(sniffImage(new Uint8Array())).toBeNull();
  });
  it('targetWidths never upscales', () => {
    expect(targetWidths(2000)).toEqual([480, 800, 1200, 1600]);
    expect(targetWidths(1000)).toEqual([480, 800]);
    expect(targetWidths(300)).toEqual([300]);
  });
  it('newMediaId is a valid MediaRef id', () => {
    const id = newMediaId('My Photo (1).JPG');
    expect(id).toMatch(/^my-photo-1-[0-9a-f]{8}$/);
    expect(MediaRef.shape.id.safeParse(id).success).toBe(true);
    expect(newMediaId('...')).toMatch(/^img-/);
  });
  it('parseVariantField', () => {
    expect(parseVariantField('w800.avif')).toEqual({ width: 800, format: 'avif' });
    expect(parseVariantField('w800.gif')).toBeNull();
    expect(parseVariantField('alt')).toBeNull();
  });
});

describe('content helpers', () => {
  const base = SiteContentDoc.parse({ nav: {}, home: { seo: {} } });
  it('changedSections ignores bookkeeping fields', () => {
    expect(changedSections({ ...base, updatedAt: '2026-01-01T00:00:00.000Z', updatedBy: 'x' }, base)).toEqual([]);
    expect(changedSections({ ...base, announcement: { enabled: true, text: 'Hi' } }, base)).toEqual(['announcement']);
  });
  it('version keys are validated and timestamped', () => {
    const k = 'versions/site-content/2026-10-17T10-05-09-123Z.json';
    expect(isContentVersionKey(k)).toBe(true);
    expect(isContentVersionKey('users.json')).toBe(false);
    expect(isContentVersionKey('versions/site-content/../users.json')).toBe(false);
    expect(versionTime(k)).toBe('2026-10-17T10:05:09.123Z');
  });
});
