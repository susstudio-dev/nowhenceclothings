import { describe, expect, it } from 'vitest';
import { SettingsDoc } from './settings';

const minimal = { shipping: { flatFee: 0, freeShippingThreshold: 0 }, store: { email: 'hello@nowhenceclothings.com' } };

describe('settings.seo', () => {
  it('defaults to empty strings for docs saved before it existed', () => {
    expect(SettingsDoc.parse(minimal).seo).toEqual({ googleSiteVerification: '', bingSiteVerification: '', indexNowKey: '' });
  });

  it('accepts verification tokens and an IndexNow key, trimmed', () => {
    const s = SettingsDoc.parse({ ...minimal, seo: { googleSiteVerification: ' abc_DEF-123 ', bingSiteVerification: 'BING0123', indexNowKey: ' a1b2c3d4e5f6 ' } });
    expect(s.seo).toEqual({ googleSiteVerification: 'abc_DEF-123', bingSiteVerification: 'BING0123', indexNowKey: 'a1b2c3d4e5f6' });
  });

  it('rejects anything that could break out of a meta tag, or a bad IndexNow key', () => {
    for (const bad of ['"><script>', 'a b', '<meta content="x">']) {
      expect(SettingsDoc.safeParse({ ...minimal, seo: { googleSiteVerification: bad } }).success).toBe(false);
      expect(SettingsDoc.safeParse({ ...minimal, seo: { bingSiteVerification: bad } }).success).toBe(false);
    }
    for (const bad of ['short', 'has space here', 'x'.repeat(129)]) {
      expect(SettingsDoc.safeParse({ ...minimal, seo: { indexNowKey: bad } }).success).toBe(false);
    }
  });

  it('survives a parse round trip (settings save re-parses the stored doc)', () => {
    const once = SettingsDoc.parse({ ...minimal, seo: { googleSiteVerification: 'tok' } });
    expect(SettingsDoc.parse(once).seo.googleSiteVerification).toBe('tok');
  });
});
