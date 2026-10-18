import type { Metadata } from 'next';
import type { MediaRef, Seo } from './schemas/common';

// SEO helpers (WS-E). Ported from furor-web's SERP-fitting helpers and adapted
// for Nowhence. Pure module: safe to import from server and client code.

/** The only crawlable origin. Every canonical / OG / sitemap URL uses it. */
export const SITE_URL = 'https://nowhenceclothings.com';
export const CANONICAL_HOST = 'nowhenceclothings.com';
export const BRAND = 'Nowhence';
export const DEFAULT_DESCRIPTION =
  'Nowhence: heavyweight piqué polos with hand-finished animal embroidery, for tennis, padel, pickleball and golf.';

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

/** Paths never indexed; mirrored in robots.ts (and X-Robots-Tag in next.config.mjs). */
export const PRIVATE_PATH_PREFIXES = ['/admin', '/api', '/cart', '/checkout', '/orders', '/book', '/pay', '/search'] as const;

/** Listing query parameters (filters / sort). Their URLs canonicalise to the bare listing. */
export const FILTER_PARAMS = ['sort', 'size', 'colour', 'min', 'max'] as const;

/** Default social card: wordmark + the cleared black polo photo, 1200x630 (public/brand-default). */
export const DEFAULT_OG_IMAGE = {
  url: `${SITE_URL}/brand-default/og-default.jpg`,
  width: 1200,
  height: 630,
  alt: 'Nowhence, polos for after the match. Black polo with tonal panther-rosette embroidery.',
} as const;

/** Square symbol PNG for Organization.logo (Google wants a crawlable square logo of at least 112px). */
export const ORG_LOGO_URL = `${SITE_URL}/brand-default/icon-512.png`;

/** True when `path` is one of the never-indexed areas. */
export function isPrivatePath(path: string): boolean {
  const p = path.split(/[?#]/)[0];
  return PRIVATE_PATH_PREFIXES.some((x) => p === x || p.startsWith(`${x}/`));
}

export function isCanonicalHost(host: string | null | undefined): boolean {
  if (!host) return false;
  return host.toLowerCase().split(':')[0] === CANONICAL_HOST;
}

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

/** Canonical URL: always the apex origin, never a query string, fragment or trailing slash. */
export function canonicalUrl(path: string): string {
  let p = path;
  if (/^https?:\/\//i.test(p)) {
    try {
      p = new URL(p).pathname;
    } catch {
      p = '/';
    }
  }
  p = p.split(/[?#]/)[0] || '/';
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return absoluteUrl(p || '/');
}

/**
 * Search Console / Bing hand out a whole `<meta ... content="TOKEN" />` tag.
 * Accept either that or the bare token, and return just the token.
 */
export function extractVerificationToken(input: string): string {
  const v = input.trim();
  const m = /content\s*=\s*["']([^"']*)["']/i.exec(v);
  return (m ? m[1] : v).trim();
}

/** Social profile as a URL: accepts `@handle`, `handle` or a full URL; '' when unusable. */
export function socialUrl(value: string | undefined, network: 'instagram' | 'x' | 'facebook' = 'instagram'): string | undefined {
  const v = (value ?? '').trim();
  if (!v) return undefined;
  if (/^https?:\/\//i.test(v)) {
    try {
      return new URL(v).toString();
    } catch {
      return undefined;
    }
  }
  const handle = v.replace(/^@/, '').replace(/^(www\.)?(instagram\.com|x\.com|twitter\.com|facebook\.com)\//i, '').replace(/\/+$/, '');
  if (!/^[A-Za-z0-9._-]{1,60}$/.test(handle)) return undefined;
  const base = { instagram: 'https://www.instagram.com', x: 'https://x.com', facebook: 'https://www.facebook.com' }[network];
  return `${base}/${handle}`;
}

/** Absolute URL for a MediaRef at its largest generated width (OG / JSON-LD). */
export function mediaUrl(media: MediaRef, format: 'webp' | 'avif' | 'jpg' = 'webp'): string {
  if (media.src) return absoluteUrl(media.src);
  const w = media.widths.length ? media.widths[media.widths.length - 1] : media.width;
  return absoluteUrl(`/media/${media.id}/${w}.${format}`);
}

/** Pixel size of the file `mediaUrl` points at (largest generated width), keeping the aspect ratio. */
export function mediaDimensions(media: MediaRef): { width: number; height: number } {
  if (media.src || !media.widths.length) return { width: media.width, height: media.height };
  const width = media.widths[media.widths.length - 1];
  return { width, height: Math.max(1, Math.round((width * media.height) / media.width)) };
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

export const TITLE_SEPARATOR = ' | ';

/**
 * Title plus " | Nowhence" when it fits; otherwise the bare (trimmed) title.
 * A title that already names the brand is left alone (no "Nowhence | Nowhence").
 */
export function fitTitle(title: string, brand: string = BRAND): string {
  const clean = title.replace(/\s+/g, ' ').trim();
  if (!clean || clean === brand) return brand;
  if (clean.toLowerCase().includes(brand.toLowerCase())) return truncateToPixels(clean, TITLE_PX);
  const candidate = `${clean}${TITLE_SEPARATOR}${brand}`;
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
  // Fits the pixel budget first, then the 155-character ceiling.
  const fit = (t: string) => {
    const px = truncateToPixels(t, DESC_PX);
    return px.length > SEO_DESC_CHARS ? truncateAtWord(px, SEO_DESC_CHARS - 1) : px;
  };
  if (!p) return fit(s);
  if (p.length >= DESC_MIN) return fit(p);
  const joined = /[.!?…:—]$/.test(p) ? `${p} ${s}` : `${p}. ${s}`;
  return fit(joined);
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
  /** Path of the page, e.g. `/products/tee-heavyweight`. Query strings are dropped from the canonical. */
  path: string;
  seo?: Seo;
  /** Fallback description source when seo.description is empty. */
  description?: string;
  /** Used when there is no description at all and the generic one would be too thin. */
  descriptionSupport?: string;
  image?: MediaRef;
  type?: 'website' | 'article';
  /** Keep the page out of the index. `follow` defaults to false. */
  noindex?: boolean;
  follow?: boolean;
  /** Skip the " | Nowhence" suffix (home page, pre-branded titles). */
  exactTitle?: boolean;
  /** ISO timestamps for articles. */
  publishedTime?: string;
  modifiedTime?: string;
}

/** Build Next `Metadata` with canonical, Open Graph and large-image Twitter cards. */
export function buildMetadata(input: PageMetaInput): Metadata {
  const raw = input.seo?.title || input.title;
  const title = input.exactTitle ? raw.replace(/\s+/g, ' ').trim() || BRAND : fitTitle(raw);
  const description = fitDescription(input.seo?.description || input.description, input.descriptionSupport);
  const url = canonicalUrl(input.path);
  const img = input.seo?.ogImage ?? input.image;
  // Every page gets a large-image card: its own image, else the branded default.
  const images = img
    ? [{ url: mediaUrl(img), ...mediaDimensions(img), alt: img.alt || title }]
    : [{ ...DEFAULT_OG_IMAGE }];
  const article = input.type === 'article';
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
      ...(article && input.publishedTime ? { publishedTime: input.publishedTime } : {}),
      ...(article && input.modifiedTime ? { modifiedTime: input.modifiedTime } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: images.map((i) => ({ url: i.url, alt: i.alt })),
    },
    // Absent (not undefined) so the root layout's robots default (large previews) still applies.
    ...(input.noindex ? { robots: { index: false, follow: input.follow ?? false } } : {}),
  };
}

/** Metadata for a page that must never be indexed (cart, checkout, orders, bookings, search). */
export function noindexMetadata(title: string, opts: { follow?: boolean } = {}): Metadata {
  return { title, robots: { index: false, follow: opts.follow ?? false } };
}
