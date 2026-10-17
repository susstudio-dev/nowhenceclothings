import type { Metadata } from 'next';
import type { MediaRef, Seo } from './schemas/common';

// SEO helpers (WS-E). Ported from furor-web's SERP-fitting helpers and adapted
// for Nowhence. Pure module: safe to import from server and client code.

/** The only crawlable origin. Every canonical / OG / sitemap URL uses it. */
export const SITE_URL = 'https://nowhenceclothings.com';
export const CANONICAL_HOST = 'nowhenceclothings.com';
export const BRAND = 'Nowhence';
export const DEFAULT_DESCRIPTION =
  'Nowhence makes considered unisex clothing. Heavyweight cotton, quiet colour, cut to be worn for years. Designed in India.';

/** URL conventions for public routes. Storefront should link via these. */
export const paths = {
  home: () => '/',
  shop: () => '/shop',
  category: (slug: string) => `/shop/${slug}`,
  collection: (slug: string) => `/collections/${slug}`,
  product: (slug: string) => `/products/${slug}`,
  drop: (slug: string) => `/drops/${slug}`,
  lookbook: (slug: string) => `/lookbook/${slug}`,
  journal: (slug: string) => `/journal/${slug}`,
  page: (slug: string) => `/${slug}`,
} as const;

/** Paths never indexed; mirrored in robots.ts. */
export const PRIVATE_PATH_PREFIXES = ['/admin', '/api', '/cart', '/checkout', '/orders'] as const;

export function isCanonicalHost(host: string | null | undefined): boolean {
  if (!host) return false;
  return host.toLowerCase().split(':')[0] === CANONICAL_HOST;
}

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

/** Absolute URL for a MediaRef at its largest generated width (OG / JSON-LD). */
export function mediaUrl(media: MediaRef, format: 'webp' | 'avif' | 'jpg' = 'webp'): string {
  if (media.src) return absoluteUrl(media.src);
  const w = media.widths.length ? media.widths[media.widths.length - 1] : media.width;
  return absoluteUrl(`/media/${media.id}/${w}.${format}`);
}

// ---- SERP fitting (ported) -------------------------------------------------

export const SEO_TITLE_CHARS = 57;
export const SEO_DESC_CHARS = 155;
const TITLE_PX = 520;
const DESC_PX = 920;
const DESC_MIN = 75;

/** Approximate SERP width in pixels (Arial 13px advances). */
export function serpPixels(s: string): number {
  let w = 0;
  for (const ch of s) {
    if (" iljt.,;:!|'`[](){}I".includes(ch)) w += 4;
    else if ('mwMW@%'.includes(ch)) w += 13;
    else if (ch >= 'A' && ch <= 'Z') w += 10;
    else w += 8;
  }
  return w;
}

function truncateToPixels(text: string, maxPx: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (serpPixels(clean) <= maxPx) return clean;
  const budget = maxPx - serpPixels('…');
  let out = '';
  for (const word of clean.split(' ')) {
    const next = out ? `${out} ${word}` : word;
    if (serpPixels(next) > budget) break;
    out = next;
  }
  return `${(out || clean.slice(0, 40)).trimEnd()}…`;
}

export function truncateAtWord(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Title plus " · Nowhence" when it fits; otherwise the bare (trimmed) title. */
export function fitTitle(title: string, brand: string = BRAND): string {
  const clean = title.replace(/\s+/g, ' ').trim();
  if (!clean || clean === brand) return brand;
  const candidate = `${clean} · ${brand}`;
  if (candidate.length <= SEO_TITLE_CHARS && serpPixels(candidate) <= TITLE_PX) return candidate;
  return truncateToPixels(clean.length <= 60 ? clean : truncateAtWord(clean, 60), TITLE_PX);
}

/** Admin copy wins when substantial; thin copy gets `support` appended. */
export function fitDescription(
  primary: string | null | undefined,
  support: string = DEFAULT_DESCRIPTION,
): string {
  const p = (primary ?? '').replace(/\s+/g, ' ').trim();
  const s = support.replace(/\s+/g, ' ').trim();
  if (!p) return truncateToPixels(s, DESC_PX);
  if (p.length >= DESC_MIN) return truncateToPixels(p, DESC_PX);
  const joined = /[.!?…:—]$/.test(p) ? `${p} ${s}` : `${p}. ${s}`;
  return truncateToPixels(joined, DESC_PX);
}

/** Strip markdown syntax so free text can feed a meta description. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*[-+]\s+/gm, '')
    .replace(/[#>*_`~]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface PageMetaInput {
  /** Fallback title when seo.title is empty. */
  title: string;
  /** Path of the page, e.g. `/products/tee-heavyweight`. */
  path: string;
  seo?: Seo;
  /** Fallback description source when seo.description is empty. */
  description?: string;
  image?: MediaRef;
  type?: 'website' | 'article';
  noindex?: boolean;
}

/** Build Next `Metadata` with canonical, Open Graph and Twitter cards. */
export function buildMetadata(input: PageMetaInput): Metadata {
  const title = fitTitle(input.seo?.title || input.title);
  const description = fitDescription(input.seo?.description || input.description);
  const url = absoluteUrl(input.path);
  const img = input.seo?.ogImage ?? input.image;
  const images = img
    ? [{ url: mediaUrl(img), width: img.width, height: img.height, alt: img.alt || title }]
    : undefined;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      type: input.type ?? 'website',
      siteName: BRAND,
      locale: 'en_IN',
      url,
      title,
      description,
      images,
    },
    twitter: {
      card: images ? 'summary_large_image' : 'summary',
      title,
      description,
      images: images?.map((i) => i.url),
    },
    robots: input.noindex ? { index: false, follow: false } : undefined,
  };
}
