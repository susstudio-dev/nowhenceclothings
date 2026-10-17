import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SettingsDoc } from './schemas/settings';
import { Page, STATIC_PAGE_SLUGS } from './schemas/site-content';
import { DEFAULT_STATIC_PAGES, STATIC_SLUGS, isPlaceholderPage, resolveStaticPage, settingsVars } from './static-pages';

describe('static pages', () => {
  it('covers every S9 slug with a valid page', () => {
    expect([...STATIC_SLUGS].sort()).toEqual([...STATIC_PAGE_SLUGS].sort());
    for (const s of STATIC_SLUGS) expect(() => Page.parse(DEFAULT_STATIC_PAGES[s])).not.toThrow();
  });

  it('falls back from seed placeholders; real copy wins', () => {
    const seeded = Page.parse(JSON.parse(readFileSync('data/site-content.json', 'utf8')).pages.faq);
    expect(isPlaceholderPage(seeded)).toBe(true);
    expect(resolveStaticPage('faq', seeded)).toBe(DEFAULT_STATIC_PAGES.faq);
    const real = Page.parse({ slug: 'faq', title: 'FAQ', blocks: [{ type: 'richText', id: 'x', markdown: 'Real.' }] });
    expect(resolveStaticPage('faq', real)).toBe(real);
    expect(resolveStaticPage('faq', undefined)).toBe(DEFAULT_STATIC_PAGES.faq);
  });

  it('derives template vars from settings', () => {
    const s = SettingsDoc.parse(JSON.parse(readFileSync('data/settings.json', 'utf8')));
    const v = settingsVars(s);
    expect(v.flatFee).toBe('₹99');
    expect(v.freeShippingThreshold).toBe('₹2,999');
    expect(v.returnWindowDays).toBe('7');
  });
});
