import { describe, expect, it } from 'vitest';
import { announcementLink } from './announcement';

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
