import type { LaunchView } from './launches';
import type { Drop, Product } from './schemas/catalogue';
import type { SettingsDoc } from './schemas/settings';
import { BRAND, ORG_LOGO_URL, SITE_URL, absoluteUrl, canonicalUrl, mediaUrl, paths, plainText, socialUrl, truncateAtWord } from './seo';

// JSON-LD builders (WS-E). Render with:
//   <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }} />
//
// Secrecy: callers must only build Product data for projected, indexable
// products (`isIndexable`). Coming-soon pieces never get Product JSON-LD.

const ORG_ID = `${SITE_URL}/#organization`;
const SCHEMA = 'https://schema.org';

/** Serialise for an inline <script>; escapes `<` so content cannot close the tag. */
export function jsonLdScript(data: unknown): string {
  // Escape <, U+2028 and U+2029 as JSON unicode escapes (backslash-u-XXXX).
  const unsafe = new RegExp('[<' + String.fromCharCode(0x2028, 0x2029) + ']', 'g');
  return JSON.stringify(data).replace(
    unsafe,
    (c) => String.fromCharCode(92) + 'u' + c.charCodeAt(0).toString(16).padStart(4, '0'),
  );
}

type OrgSettings = Pick<SettingsDoc, 'store'> & { legal?: Pick<SettingsDoc['legal'], 'legalName'> };

export function organizationLd(settings?: OrgSettings) {
  const store = settings?.store;
  const legalName = settings?.legal?.legalName || store?.legalName || undefined;
  const sameAs = [socialUrl(store?.instagram, 'instagram')].filter((u): u is string => !!u);
  const phone = store?.phone?.trim();
  return {
    '@context': SCHEMA,
    '@type': 'Organization',
    '@id': ORG_ID,
    name: store?.name || BRAND,
    legalName,
    url: SITE_URL,
    // Square PNG of the symbol, well above Google's 112px minimum.
    logo: { '@type': 'ImageObject', url: ORG_LOGO_URL, width: 512, height: 512 },
    email: store?.email || undefined,
    sameAs: sameAs.length ? sameAs : undefined,
    contactPoint: store?.email
      ? {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          email: store.email,
          telephone: phone || undefined,
          areaServed: 'IN',
          availableLanguage: ['English'],
        }
      : undefined,
  };
}

/** WebSite with a sitelinks search box (SearchAction -> /search?q=). */
export function webSiteLd() {
  return {
    '@context': SCHEMA,
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: BRAND,
    url: SITE_URL,
    inLanguage: 'en-IN',
    publisher: { '@id': ORG_ID },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    '@context': SCHEMA,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: canonicalUrl(item.path),
    })),
  };
}

/** Breadcrumb trail for a product: Home / Shop / Category / Product. */
export function productBreadcrumb(product: Pick<Product, 'title' | 'slug'>, category?: { name: string; slug: string }) {
  return breadcrumbLd([
    { name: 'Home', path: paths.home() },
    { name: 'Shop', path: paths.shop() },
    ...(category ? [{ name: category.name, path: paths.category(category.slug) }] : []),
    { name: product.title, path: paths.product(product.slug) },
  ]);
}

const paiseToAmount = (p: number) => (p / 100).toFixed(2);
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export type ProductLdInput = Product & { launch?: LaunchView };

export interface ProductLdOptions {
  /** Units available per SKU. A missing SKU counts as 0. */
  stock?: Record<string, number>;
  /** The product's drop, if any; before release the offer is PreOrder. */
  drop?: Drop;
  /** Shipping fee and returns policy; when present they are described on the offer. */
  settings?: Pick<SettingsDoc, 'shipping' | 'returns'>;
  /** Category name, emitted as Product.category. */
  category?: { name: string };
  now?: Date;
}

export interface ProductAvailability {
  availability: 'https://schema.org/PreOrder' | 'https://schema.org/InStock' | 'https://schema.org/OutOfStock';
  /** ISO timestamp the offer opens, for PreOrder. */
  availabilityStarts?: string;
}

/** PreOrder for presale / deposit booking / unreleased drop; InStock or OutOfStock otherwise. */
export function productAvailability(product: ProductLdInput, opts: Pick<ProductLdOptions, 'stock' | 'drop' | 'now'> = {}): ProductAvailability {
  const now = opts.now ?? new Date();
  const state = product.launch?.state;
  const dropAt = opts.drop && new Date(opts.drop.releaseAt) > now ? opts.drop.releaseAt : undefined;
  if (state === 'presale' || (dropAt && state !== 'sold_out')) {
    const starts = product.launch?.presale?.deposit?.saleStartsAt ?? dropAt;
    return { availability: 'https://schema.org/PreOrder', ...(starts ? { availabilityStarts: starts } : {}) };
  }
  if (state === 'sold_out') return { availability: 'https://schema.org/OutOfStock' };
  const inStock = product.variants.some((v) => (opts.stock?.[v.sku] ?? 0) > 0);
  return { availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' };
}

/** Last day the quoted price is valid: end of a live sale, else of the presale, else a year out. */
export function priceValidUntil(product: ProductLdInput, now: Date = new Date()): string {
  const future = (iso: string | undefined) => (iso && new Date(iso) > now ? isoDay(new Date(iso)) : undefined);
  const onSale = product.compareAtPrice != null && product.compareAtPrice > product.price;
  const sale = onSale ? future(product.saleEndsAt) : undefined;
  const presale = future(product.launch?.presale?.endsAt);
  const year = new Date(now);
  year.setUTCFullYear(year.getUTCFullYear() + 1);
  return sale ?? presale ?? isoDay(year);
}

function shippingDetails(price: number, shipping: SettingsDoc['shipping']) {
  const free = shipping.freeShippingThreshold > 0 && price >= shipping.freeShippingThreshold;
  const fee = free ? 0 : shipping.flatFee;
  return {
    '@type': 'OfferShippingDetails',
    shippingRate: { '@type': 'MonetaryAmount', value: paiseToAmount(fee), currency: 'INR' },
    shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IN' },
  };
}

/** MerchantReturnPolicy from Settings -> Returns. */
export function returnPolicyLd(returns: SettingsDoc['returns']) {
  const allowed = (returns.returnsAllowed || returns.exchangesAllowed) && returns.windowDays > 0;
  return {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: 'IN',
    returnPolicyCategory: allowed
      ? 'https://schema.org/MerchantReturnFiniteReturnWindow'
      : 'https://schema.org/MerchantReturnNotPermitted',
    ...(allowed ? { merchantReturnDays: returns.windowDays, returnMethod: 'https://schema.org/ReturnByMail' } : {}),
    merchantReturnLink: absoluteUrl(paths.page('returns')),
  };
}

/**
 * One `Product` per page: brand, sku/mpn, images and a GST-inclusive INR offer
 * (an `AggregateOffer` only when variants are priced differently).
 */
export function productLd(product: ProductLdInput, opts: ProductLdOptions = {}) {
  const url = canonicalUrl(paths.product(product.slug));
  const now = opts.now ?? new Date();
  const description = truncateAtWord(plainText(product.seo.description || product.description), 5000) || undefined;
  const images = [...new Set(product.colours.flatMap((c) => c.images).map((m) => mediaUrl(m)))].slice(0, 10);
  const prices = product.variants.map((v) => v.priceOverride ?? product.price);
  const low = Math.min(product.price, ...prices);
  const high = Math.max(product.price, ...prices);
  const first = product.variants[0];

  const common = {
    priceCurrency: 'INR',
    priceValidUntil: priceValidUntil(product, now),
    ...productAvailability(product, opts),
    itemCondition: 'https://schema.org/NewCondition',
    url,
    seller: { '@id': ORG_ID },
    shippingDetails: opts.settings ? shippingDetails(low, opts.settings.shipping) : undefined,
    hasMerchantReturnPolicy: opts.settings ? returnPolicyLd(opts.settings.returns) : undefined,
  };
  const offers =
    low === high
      ? { '@type': 'Offer', price: paiseToAmount(low), ...common }
      : { '@type': 'AggregateOffer', lowPrice: paiseToAmount(low), highPrice: paiseToAmount(high), offerCount: product.variants.length, ...common };

  return {
    '@context': SCHEMA,
    '@type': 'Product',
    '@id': `${url}#product`,
    name: product.title,
    description,
    url,
    sku: first?.sku,
    mpn: first?.sku,
    brand: { '@type': 'Brand', name: BRAND },
    image: images.length ? images : undefined,
    color: product.colours.length === 1 ? product.colours[0].name : undefined,
    material: product.fabric || undefined,
    category: opts.category?.name,
    audience: { '@type': 'PeopleAudience', suggestedGender: 'unisex' },
    offers,
  };
}

export function faqLd(items: { q: string; a: string }[]) {
  return {
    '@context': SCHEMA,
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({
      '@type': 'Question',
      name: i.q,
      acceptedAnswer: { '@type': 'Answer', text: plainText(i.a) },
    })),
  };
}
