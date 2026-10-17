import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SettingsDoc, migrateSettingsInput } from './schemas/settings';
import {
  brandContrastChecks,
  brandCssText,
  brandCssVars,
  contrastGrade,
  contrastRatio,
  emailFromHeader,
  formatLegalDate,
  launchReadiness,
  missingForLaunch,
} from './brand';

const legacy = {
  currency: 'INR',
  shipping: { flatFee: 9900, freeShippingThreshold: 299900, eta: 'Ships in 2-4 working days' },
  tax: { pricesIncludeTax: true, gstRatePercent: 12, gstin: '29ABCDE1234F1Z5' },
  store: { name: 'Nowhence', legalName: 'Nowhence LLP', email: 'hello@nowhenceclothings.com', phone: '', address: 'Bengaluru', instagram: '' },
  orders: { paymentWindowMinutes: 30, returnWindowDays: 14, maxQtyPerLine: 10 },
  email: { from: 'Nowhence <orders@nowhenceclothings.com>', replyTo: '' },
};

describe('settings schema migration (A9)', () => {
  it('parses a pre-A9 doc and moves legacy fields into legal/returns', () => {
    const s = SettingsDoc.parse(legacy);
    expect(s.legal).toMatchObject({ legalName: 'Nowhence LLP', gstin: '29ABCDE1234F1Z5', registeredAddress: 'Bengaluru' });
    expect(s.returns.windowDays).toBe(14);
    expect(s.brand.wordmark).toBe('NOWHENCE');
    expect(s.brand.colours.ink).toBe('#0b0b0b');
    expect(s.email.senderName).toBe('');
  });

  it('keeps legacy mirrors in sync with canonical fields', () => {
    const s = SettingsDoc.parse({ ...legacy, legal: { legalName: 'New Co', gstin: 'X' }, returns: { windowDays: 3 } });
    expect(s.store.legalName).toBe('New Co');
    expect(s.tax.gstin).toBe('X');
    expect(s.orders.returnWindowDays).toBe(3);
    expect(SettingsDoc.parse(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it('does not migrate when the new sections exist', () => {
    expect((migrateSettingsInput({ ...legacy, legal: {} }) as { legal: object }).legal).toEqual({});
    expect(migrateSettingsInput(null)).toBeNull();
  });

  it('rejects bad colours and unknown fonts', () => {
    expect(() => SettingsDoc.parse({ ...legacy, brand: { colours: { ink: 'black' } } })).toThrow();
    expect(() => SettingsDoc.parse({ ...legacy, brand: { displayFont: 'comic-sans' } })).toThrow();
  });

  it('seed data parses', () => {
    const s = SettingsDoc.parse(JSON.parse(readFileSync('data/settings.json', 'utf8')));
    expect(s.email.senderName).toBe('Nowhence');
  });
});

describe('contrast', () => {
  it('matches WCAG reference values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
    expect(Number.isNaN(contrastRatio('nope', '#fff000'))).toBe(true);
  });

  it('grades and checks the palette', () => {
    expect(contrastGrade(7.1)).toBe('AAA');
    expect(contrastGrade(4.6)).toBe('AA');
    expect(contrastGrade(3.2)).toBe('AA-large');
    expect(contrastGrade(2)).toBe('fail');
    expect(contrastGrade(NaN)).toBe('fail');
    expect(brandContrastChecks({ ink: '#161513', paper: '#f8f6f1', accent: '#605440' }).every((c) => c.ok)).toBe(true);
    const bad = brandContrastChecks({ ink: '#cccccc', paper: '#ffffff', accent: '#eeeeee' });
    expect(bad.filter((c) => !c.ok).map((c) => c.id)).toEqual(['ink-paper', 'accent-paper']);
  });
});

describe('css vars', () => {
  const base = SettingsDoc.parse(legacy).brand;
  it('only maps fonts for the default palette', () => {
    expect(brandCssVars(base)).toEqual({ '--font-display': 'var(--font-jost)', '--font-sans': 'var(--font-inter-tight)' });
  });
  it('emits rgb channels for a custom palette', () => {
    const v = brandCssVars({ ...base, bodyFont: 'manrope', colours: { ink: '#000000', paper: '#ffffff', accent: '#ff0000' } });
    expect(v['--c-ink']).toBe('0 0 0');
    expect(v['--c-paper']).toBe('255 255 255');
    expect(v['--c-accent']).toBe('255 0 0');
    expect(v['--font-sans']).toBe('var(--font-manrope)');
    expect(brandCssText(base).startsWith(':root{--font-display:var(--font-jost);')).toBe(true);
  });
});

describe('launch readiness', () => {
  it('lists empty required fields and clears when filled', () => {
    const s = SettingsDoc.parse(legacy);
    const ids = missingForLaunch(s).map((m) => m.id);
    expect(ids).toEqual(
      expect.arrayContaining(['brand.favicon', 'legal.jurisdictionCity', 'legal.privacyUpdatedAt', 'legal.termsUpdatedAt', 'email.senderName', 'email.replyTo', 'store.phone']),
    );
    expect(ids).not.toContain('legal.legalName');
    const full = SettingsDoc.parse({
      ...legacy,
      store: { ...legacy.store, phone: '+91 80 0000 0000' },
      email: { senderName: 'Nowhence', from: legacy.email.from, replyTo: 'hello@nowhenceclothings.com' },
      brand: { favicon: { id: 'fav-1', width: 512, height: 512 } },
      legal: {
        legalName: 'Nowhence LLP',
        gstin: '29ABCDE1234F1Z5',
        registeredAddress: '1 MG Road, Bengaluru',
        jurisdictionCity: 'Bengaluru',
        privacyUpdatedAt: '2026-10-01',
        termsUpdatedAt: '2026-10-01',
      },
    });
    expect(missingForLaunch(full)).toEqual([]);
    expect(launchReadiness(full).length).toBeGreaterThan(10);
  });
});

describe('misc', () => {
  it('formats sender and legal dates', () => {
    expect(emailFromHeader({ senderName: 'Nowhence Studio', from: 'X <orders@n.com>', replyTo: '' })).toBe('Nowhence Studio <orders@n.com>');
    expect(emailFromHeader({ senderName: '', from: 'orders@n.com', replyTo: '' })).toBe('orders@n.com');
    expect(formatLegalDate('2026-10-17')).toBe('17 October 2026');
    expect(formatLegalDate('')).toBe('');
  });
});
