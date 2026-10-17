import { describe, expect, it } from 'vitest';
import {
  SITE_URL,
  absoluteUrl,
  buildMetadata,
  fitDescription,
  fitTitle,
  isCanonicalHost,
  mediaUrl,
  plainText,
  truncateAtWord,
} from './seo';

const img = { id: 'hero_1', alt: 'Tee', width: 1600, height: 2000, widths: [640, 1280] };

describe('seo', () => {
  it('treats only the apex as canonical', () => {
    expect(isCanonicalHost('nowhenceclothings.com')).toBe(true);
    expect(isCanonicalHost('NOWHENCECLOTHINGS.COM:443')).toBe(true);
    expect(isCanonicalHost('www.nowhenceclothings.com')).toBe(false);
    expect(isCanonicalHost('nowhence.workers.dev')).toBe(false);
    expect(isCanonicalHost(null)).toBe(false);
  });

  it('builds absolute and media urls', () => {
    expect(absoluteUrl('/shop')).toBe(`${SITE_URL}/shop`);
    expect(absoluteUrl('shop')).toBe(`${SITE_URL}/shop`);
    expect(absoluteUrl('https://x.test/a')).toBe('https://x.test/a');
    expect(mediaUrl(img)).toBe(`${SITE_URL}/media/hero_1/1280.webp`);
    expect(mediaUrl({ ...img, widths: [] })).toBe(`${SITE_URL}/media/hero_1/1600.webp`);
    expect(mediaUrl({ ...img, src: 'https://placehold.co/1x1' })).toBe('https://placehold.co/1x1');
  });

  it('fitTitle adds the brand when it fits and trims otherwise', () => {
    expect(fitTitle('Shipping')).toBe('Shipping · Nowhence');
    expect(fitTitle('Nowhence')).toBe('Nowhence');
    const long = fitTitle('A very long product title that goes on and on well past the limit of a SERP');
    expect(long).not.toContain('Nowhence');
    expect(long.endsWith('…')).toBe(true);
  });

  it('fitDescription falls back, joins and trims', () => {
    expect(fitDescription('')).toContain('Nowhence');
    expect(fitDescription('Short lead')).toMatch(/^Short lead\. /);
    expect(fitDescription('word '.repeat(80)).endsWith('…')).toBe(true);
  });

  it('truncateAtWord and plainText', () => {
    expect(truncateAtWord('alpha beta gamma', 11)).toBe('alpha beta…');
    expect(plainText('# Hi\n- **bold** [link](/x)')).toBe('Hi bold link');
  });

  it('buildMetadata sets canonical, OG and robots', () => {
    const m = buildMetadata({ title: 'About', path: '/about', image: img, noindex: true });
    expect(m.alternates?.canonical).toBe(`${SITE_URL}/about`);
    expect(m.title).toEqual({ absolute: 'About · Nowhence' });
    const og = m.openGraph as { url: string; images: { url: string }[] };
    expect(og.url).toBe(`${SITE_URL}/about`);
    expect(og.images[0].url).toContain('/media/hero_1/');
    expect(m.robots).toEqual({ index: false, follow: false });
    expect(buildMetadata({ title: 'x', path: '/', seo: { title: 'Custom' } }).title).toEqual({
      absolute: 'Custom · Nowhence',
    });
  });
});
