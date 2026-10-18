import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SettingsDoc } from './schemas/settings';
import { Page, STATIC_PAGE_SLUGS } from './schemas/site-content';
import {
  DEFAULT_STATIC_PAGES,
  STATIC_SLUGS,
  contactList,
  isPlaceholderPage,
  resolveReturnsLabel,
  resolveStaticPage,
  returnsLabel,
  settingsVars,
  withReturnsNavLabel,
  withReturnsTitle,
} from './static-pages';

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
    expect(v.shippingSummary).toBe('Flat ₹99 shipping. Free on orders of ₹2,999 or more.');
  });

  it('lists only the contact channels that are set', () => {
    expect(contactList({ email: 'hello@nowhenceclothings.com', phone: '9014352958', instagram: 'nowhence_clothings' })).toBe(
      [
        '- WhatsApp: [+91 90143 52958](https://wa.me/919014352958)',
        '- Email: [hello@nowhenceclothings.com](mailto:hello@nowhenceclothings.com)',
        '- Instagram: [@nowhence_clothings](https://www.instagram.com/nowhence_clothings)',
      ].join('\n'),
    );
    expect(contactList({ email: 'a@b.co', phone: '', instagram: '' })).toBe('- Email: [a@b.co](mailto:a@b.co)');
  });

  it('fills legal and returns tokens from settings (no [[TBD]] once filled)', async () => {
    const { fillTemplate } = await import('./markdown');
    const s = SettingsDoc.parse({
      ...JSON.parse(readFileSync('data/settings.json', 'utf8')),
      store: { name: 'Nowhence', email: 'hello@nowhenceclothings.com', phone: '1', address: 'Studio' },
      legal: { legalName: 'Nowhence LLP', gstin: '29ABCDE1234F1Z5', registeredAddress: 'Reg', jurisdictionCity: 'Bengaluru', privacyUpdatedAt: '2026-10-01', termsUpdatedAt: '2026-10-02' },
      returns: { windowDays: 10, returnsAllowed: false, exchangesAllowed: true, policyMarkdown: 'Custom policy.' },
    });
    const v = settingsVars(s);
    for (const slug of STATIC_SLUGS) {
      for (const b of DEFAULT_STATIC_PAGES[slug].blocks) {
        const text = b.type === 'richText' ? b.markdown : b.type === 'faq' ? b.items.map((i) => i.a).join('\n') : '';
        expect(fillTemplate(text, v)).not.toContain('[[TBD');
      }
    }
    const terms = fillTemplate((DEFAULT_STATIC_PAGES.terms.blocks[0] as { markdown: string }).markdown, v);
    expect(terms).toContain('Courts at Bengaluru');
    expect(terms).toContain('2 October 2026');
    const returns = fillTemplate((DEFAULT_STATIC_PAGES.returns.blocks[0] as { markdown: string }).markdown, v);
    expect(returns).toContain('10 days from delivery to ask for an exchange');
    expect(returns).toContain('Custom policy.');
  });
});

describe('F14 returns label', () => {
  const s = (returnsAllowed: boolean, exchangesAllowed: boolean) =>
    ({ returns: { returnsAllowed, exchangesAllowed } }) as Pick<SettingsDoc, 'returns'>;

  it('derives the label from settings', () => {
    expect(returnsLabel(s(true, true).returns)).toBe('Returns & exchange');
    expect(returnsLabel(s(true, false).returns)).toBe('Returns');
    expect(returnsLabel(s(false, true).returns)).toBe('Exchanges');
    expect(returnsLabel(s(false, false).returns)).toBe('Returns policy');
  });

  it('rewrites auto labels on page title, SEO, heading and nav; keeps custom labels', () => {
    const page = withReturnsTitle(DEFAULT_STATIC_PAGES.returns, s(true, false));
    expect(page.title).toBe('Returns');
    expect(page.seo?.title).toBe('Returns');
    const first = page.blocks[0];
    expect(first.type === 'richText' && first.markdown.startsWith('# Returns\n')).toBe(true);
    const links = withReturnsNavLabel(
      [
        { label: 'Returns & exchange', href: '/returns' },
        { label: 'Shipping', href: '/shipping' },
      ],
      s(false, true),
    );
    expect(links.map((l) => l.label)).toEqual(['Exchanges', 'Shipping']);
    expect(resolveReturnsLabel('Our promise', s(false, false))).toBe('Our promise');
  });
});
