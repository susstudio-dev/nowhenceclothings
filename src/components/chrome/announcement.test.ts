import { describe, expect, it } from 'vitest';
import { announcementLink, resolveAnnouncement, shortDate } from './announcement';

describe('announcementLink', () => {
  it('keeps site paths internal', () => {
    expect(announcementLink('/coming-soon')).toEqual({ href: '/coming-soon', external: false });
    expect(announcementLink(' coming-soon ')).toEqual({ href: '/coming-soon', external: false });
    expect(announcementLink('https://nowhenceclothings.com/shop?x=1')).toEqual({ href: '/shop?x=1', external: false });
    expect(announcementLink('https://www.nowhenceclothings.com')).toEqual({ href: '/', external: false });
  });
  it('marks other sites external', () => {
    expect(announcementLink('https://instagram.com/nowhence')).toEqual({ href: 'https://instagram.com/nowhence', external: true });
    expect(announcementLink('mailto:hello@nowhenceclothings.com')?.external).toBe(true);
  });
  it('drops empty and unsafe links', () => {
    expect(announcementLink(undefined)).toBeUndefined();
    expect(announcementLink('  ')).toBeUndefined();
    expect(announcementLink('javascript:alert(1)')).toBeUndefined();
    expect(announcementLink('data:text/html,x')).toBeUndefined();
    expect(announcementLink('//evil.example')).toBeUndefined();
  });
});

describe('resolveAnnouncement', () => {
  const on = { enabled: true, text: 'Pre orders open' };
  it('is empty when disabled or blank', () => {
    expect(resolveAnnouncement({ ...on, enabled: false }, { slug: 'x' })).toBeUndefined();
    expect(resolveAnnouncement({ enabled: true, text: '   ' })).toBeUndefined();
  });
  it('keeps the owner link', () => {
    expect(resolveAnnouncement({ ...on, href: '/coming-soon' }, { slug: 'x', note: 'Sale opens 31 Oct' })).toEqual({
      text: 'Pre orders open',
      href: '/coming-soon',
      external: false,
    });
  });
  it('points at the open pre-order piece when there is no link', () => {
    expect(resolveAnnouncement(on, { slug: 'ring-polo', note: 'Sale opens 31 Oct' })).toEqual({
      text: 'Pre orders open',
      href: '/products/ring-polo',
      external: false,
      note: 'Sale opens 31 Oct',
    });
  });
  it('adds the date only to pre-order copy without its own date', () => {
    expect(resolveAnnouncement({ enabled: true, text: 'Free shipping over ₹2,000' }, { slug: 'p', note: 'Sale opens 31 Oct' })?.note).toBeUndefined();
    expect(resolveAnnouncement({ enabled: true, text: 'Pre-orders close 30.10' }, { slug: 'p', note: 'Sale opens 31 Oct' })?.note).toBeUndefined();
  });
  it('is plain text with no link and no pre-order', () => {
    expect(resolveAnnouncement(on)).toEqual({ text: 'Pre orders open' });
  });
});

describe('shortDate', () => {
  it('formats in India time', () => {
    expect(shortDate('2026-10-31T04:30:00.000Z')).toBe('31 Oct');
    expect(shortDate('2026-10-30T20:00:00.000Z')).toBe('31 Oct');
    expect(shortDate('nope')).toBe('');
  });
});
