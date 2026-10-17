import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OG_IMAGE,
  SITE_URL,
  absoluteUrl,
  buildMetadata,
  canonicalUrl,
  extractVerificationToken,
  fitDescription,
  fitTitle,
  isCanonicalHost,
  isPrivatePath,
  mediaDimensions,
  mediaUrl,
  noindexMetadata,
  plainText,
  socialUrl,
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
    expect(fitTitle('Shipping')).toBe('Shipping | Nowhence');
    expect(fitTitle('Ring Embroidered Polo — Pre-order')).toBe('Ring Embroidered Polo — Pre-order | Nowhence');
    // No doubled brand.
    expect(fitTitle('About Nowhence')).toBe('About Nowhence');
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
    const m = buildMetadata({ title: 'About', path: '/about?utm=x', image: img, noindex: true });
    expect(m.alternates?.canonical).toBe(`${SITE_URL}/about`);
    expect(m.title).toEqual({ absolute: 'About | Nowhence' });
    const og = m.openGraph as { url: string; images: { url: string; width: number; height: number }[] };
    expect(og.url).toBe(`${SITE_URL}/about`);
    expect(og.images[0].url).toContain('/media/hero_1/');
    // Declared dimensions match the file served (largest generated width).
    expect(og.images[0]).toMatchObject({ width: 1280, height: 1600 });
    expect(m.robots).toEqual({ index: false, follow: false });
    expect(buildMetadata({ title: "x", path: "/x" })).not.toHaveProperty("robots");
    expect(buildMetadata({ title: 'x', path: '/', seo: { title: 'Custom' } }).title).toEqual({ absolute: 'Custom | Nowhence' });
    expect(buildMetadata({ title: 'x', path: '/p', noindex: true, follow: true }).robots).toEqual({ index: false, follow: true });
  });

  it('every page gets a large-image card, falling back to the branded default', () => {
    const m = buildMetadata({ title: 'Shipping', path: '/shipping' });
    const og = m.openGraph as { images: { url: string; width: number; height: number }[] };
    expect(og.images[0]).toMatchObject({ url: `${SITE_URL}/brand-default/og-default.jpg`, width: 1200, height: 630 });
    expect(DEFAULT_OG_IMAGE.url.endsWith('.jpg')).toBe(true);
    const tw = m.twitter as { card: string; images: { url: string }[] };
    expect(tw.card).toBe('summary_large_image');
    expect(tw.images[0].url).toBe(DEFAULT_OG_IMAGE.url);
    // Admin ogImage beats the page image.
    const own = buildMetadata({ title: 'x', path: '/x', image: img, seo: { ogImage: { ...img, id: 'og_1' } } });
    expect((own.openGraph as { images: { url: string }[] }).images[0].url).toContain('/media/og_1/');
  });

  it('exactTitle skips the brand suffix; descriptions stay within 155 characters', () => {
    expect(buildMetadata({ title: 'Nowhence | Considered unisex clothing', path: '/', exactTitle: true }).title).toEqual({
      absolute: 'Nowhence | Considered unisex clothing',
    });
    const long = buildMetadata({ title: 'x', path: '/x', description: 'word '.repeat(80) }).description!;
    expect(long.length).toBeLessThanOrEqual(155);
    for (const d of ['', 'Short.', 'A '.repeat(200), 'W'.repeat(300)]) expect(fitDescription(d).length).toBeLessThanOrEqual(155);
  });

  it('articles carry published and modified times', () => {
    const m = buildMetadata({ title: 'Note', path: '/journal/note', type: 'article', publishedTime: '2026-01-01T00:00:00.000Z', modifiedTime: '2026-02-01T00:00:00.000Z' });
    expect(m.openGraph).toMatchObject({ type: 'article', publishedTime: '2026-01-01T00:00:00.000Z', modifiedTime: '2026-02-01T00:00:00.000Z' });
  });

  it('canonicalUrl drops query, fragment, trailing slash and foreign hosts', () => {
    expect(canonicalUrl('/shop/?sort=new#x')).toBe(`${SITE_URL}/shop`);
    expect(canonicalUrl('/')).toBe(`${SITE_URL}/`);
    expect(canonicalUrl('')).toBe(`${SITE_URL}/`);
    expect(canonicalUrl('https://www.nowhenceclothings.com/products/a/?sku=1')).toBe(`${SITE_URL}/products/a`);
    expect(canonicalUrl('https://nowhence.workers.dev/about')).toBe(`${SITE_URL}/about`);
  });

  it('knows which paths are private', () => {
    for (const p of ['/admin', '/admin/orders', '/api/x', '/cart', '/checkout/confirmation', '/orders/track', '/book/polo', '/pay/tok', '/search?q=a']) {
      expect(isPrivatePath(p)).toBe(true);
    }
    for (const p of ['/', '/shop', '/products/booking-polo', '/payments', '/cartography', '/searchable']) expect(isPrivatePath(p)).toBe(false);
    expect(noindexMetadata('Bag').robots).toEqual({ index: false, follow: false });
    expect(noindexMetadata('Search', { follow: true }).robots).toEqual({ index: false, follow: true });
  });

  it('mediaDimensions follows the served width', () => {
    expect(mediaDimensions(img)).toEqual({ width: 1280, height: 1600 });
    expect(mediaDimensions({ ...img, widths: [] })).toEqual({ width: 1600, height: 2000 });
    expect(mediaDimensions({ ...img, src: 'https://x.test/a.png' })).toEqual({ width: 1600, height: 2000 });
  });

  it('socialUrl accepts handles and URLs, rejects junk', () => {
    expect(socialUrl('@nowhence_clothings')).toBe('https://www.instagram.com/nowhence_clothings');
    expect(socialUrl('nowhence_clothings')).toBe('https://www.instagram.com/nowhence_clothings');
    expect(socialUrl('instagram.com/nowhence_clothings/')).toBe('https://www.instagram.com/nowhence_clothings');
    expect(socialUrl('https://www.instagram.com/nowhence_clothings/')).toBe('https://www.instagram.com/nowhence_clothings/');
    expect(socialUrl('')).toBeUndefined();
    expect(socialUrl('not a handle!')).toBeUndefined();
  });

  it('extractVerificationToken takes the content value from a pasted tag', () => {
    expect(extractVerificationToken('<meta name="google-site-verification" content="abc_DEF-123" />')).toBe('abc_DEF-123');
    expect(extractVerificationToken("  content='tok'  ")).toBe('tok');
    expect(extractVerificationToken(' abc_DEF-123 ')).toBe('abc_DEF-123');
  });
});
