import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SettingsDoc } from './settings';
import { DEFAULT_META_PIXEL_ID } from '../analytics/meta';

const minimal = { shipping: { flatFee: 0, freeShippingThreshold: 0 }, store: { email: 'hello@nowhenceclothings.com' } };

describe('settings.analytics.metaPixelId', () => {
  it('defaults to the owner pixel when a live doc has no analytics block', () => {
    expect(SettingsDoc.parse(minimal).analytics.metaPixelId).toBe('1574364723928175');
    expect(SettingsDoc.parse({ ...minimal, analytics: {} }).analytics.metaPixelId).toBe(DEFAULT_META_PIXEL_ID);
  });

  it('parses the committed seed settings.json (written before analytics existed)', () => {
    const doc = JSON.parse(readFileSync(path.join(process.cwd(), 'data', 'settings.json'), 'utf8'));
    const parsed = SettingsDoc.parse(doc);
    expect(parsed.analytics.metaPixelId).toBe(typeof doc.analytics?.metaPixelId === 'string' ? doc.analytics.metaPixelId.trim() : DEFAULT_META_PIXEL_ID);
  });

  it('keeps an empty string (pixel off) and trims a pasted id', () => {
    expect(SettingsDoc.parse({ ...minimal, analytics: { metaPixelId: '' } }).analytics.metaPixelId).toBe('');
    expect(SettingsDoc.parse({ ...minimal, analytics: { metaPixelId: ' 123456789012345 ' } }).analytics.metaPixelId).toBe('123456789012345');
  });

  it('rejects ids that are not digits (they are inlined into a script)', () => {
    for (const bad of ["1'); alert(1); //", 'abc123456', '12345', '1'.repeat(21)]) {
      expect(SettingsDoc.safeParse({ ...minimal, analytics: { metaPixelId: bad } }).success).toBe(false);
    }
  });

  it('round-trips through a save (admin PUT shape)', () => {
    const saved = SettingsDoc.parse(SettingsDoc.parse({ ...minimal, analytics: { metaPixelId: '999999999999999' } }));
    expect(saved.analytics).toEqual({ metaPixelId: '999999999999999' });
  });
});
