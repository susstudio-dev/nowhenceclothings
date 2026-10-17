import { describe, expect, it } from 'vitest';
import { DEFAULT_SITE_CONTENT, contentPublishWarnings, withContentFallback } from './content-defaults';
import { SiteContentDoc } from './schemas/site-content';

const empty = SiteContentDoc.parse({
  announcement: { enabled: false, text: '' },
  nav: { primary: [], footer: [] },
  home: { blocks: [], seo: {} },
  pages: {},
  lookbook: [],
  journal: [],
});

describe('withContentFallback', () => {
  it('bundled defaults have home blocks and nav', () => {
    expect(DEFAULT_SITE_CONTENT.home.blocks.length).toBeGreaterThan(0);
    expect(DEFAULT_SITE_CONTENT.nav.primary.length).toBeGreaterThan(0);
  });
  it('missing doc -> defaults', () => {
    expect(withContentFallback(null)).toBe(DEFAULT_SITE_CONTENT);
  });
  it('empty doc -> per-section defaults, keeps other fields', () => {
    const out = withContentFallback({ ...empty, announcement: { enabled: true, text: 'Hi' } });
    expect(out.home.blocks).toEqual(DEFAULT_SITE_CONTENT.home.blocks);
    expect(out.nav.primary).toEqual(DEFAULT_SITE_CONTENT.nav.primary);
    expect(out.announcement.text).toBe('Hi');
  });
  it('non-empty sections are kept', () => {
    const doc = { ...DEFAULT_SITE_CONTENT, home: { ...DEFAULT_SITE_CONTENT.home, blocks: DEFAULT_SITE_CONTENT.home.blocks.slice(0, 1) } };
    expect(withContentFallback(doc)).toBe(doc);
  });
  it('warns on empty home/nav', () => {
    expect(contentPublishWarnings(empty)).toHaveLength(2);
    expect(contentPublishWarnings(DEFAULT_SITE_CONTENT)).toHaveLength(0);
  });
});
