import type { Drop, Product } from './schemas/catalogue';
import type { SettingsDoc } from './schemas/settings';
import { BRAND, SITE_URL, absoluteUrl, mediaUrl, paths, plainText, truncateAtWord } from './seo';

// JSON-LD builders (WS-E). Render with:
//   <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }} />

const ORG_ID = `${SITE_URL}/#organization`;

/** Serialise for an inline <script>; escapes `<` so content cannot close the tag. */
export function jsonLdScript(data: unknown): string {
  // Escape <, U+2028 and U+2029 as JSON unicode escapes (backslash-u-XXXX).
  const unsafe = new RegExp('[<' + String.fromCharCode(0x2028, 0x2029) + ']', 'g');
  return JSON.stringify(data).replace(
    unsafe,
    (c) => String.fromCharCode(92) + 'u' + c.charCodeAt(0).toString(16).padStart(4, '0'),
  );
}

export function organizationLd(settings?: Pick<SettingsDoc, 'store'>) {
  const store = settings?.store;
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: store?.name || BRAND,
    legalName: store?.legalName || undefined,
    url: SITE_URL,
    logo: `${SITE_URL}/icon.png`,
    email: store?.email || undefined,
    sameAs: store?.instagram ? [store.instagram] : undefined,
  };
}

export function webSiteLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: BRAND,
    url: SITE_URL,
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
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

const paiseToAmount = (p: number) => (p / 100).toFixed(2);

export interface ProductLdOptions {
  /** Units available per SKU. A missing SKU counts as 0. */
  stock?: Record<string, number>;
  /** The product's drop, if any; before release offers are PreOrder. */
  drop?: Drop;
  now?: Date;
}

/**
 * `ProductGroup` (one per product) with a `Product` per variant, so search
 * engines read per-size price and availability. Prices are GST-inclusive INR.
 */
export function productLd(product: Product, opts: ProductLdOptions = {}) {
  const url = absoluteUrl(paths.product(product.slug));
  const now = opts.now ?? new Date();
  const unreleased = opts.drop ? new Date(opts.drop.releaseAt) > now : false;
  const description =
    truncateAtWord(plainText(product.seo.description || product.description), 5000) || undefined;
  const colourById = new Map(product.colours.map((c) => [c.id, c]));
  const allImages = product.colours.flatMap((c) => c.images).map((m) => mediaUrl(m));

  const hasVariant = product.variants.map((v) => {
    const colour = colourById.get(v.colourId);
    const qty = opts.stock?.[v.sku] ?? 0;
    const availability = unreleased
      ? 'https://schema.org/PreOrder'
      : qty > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock';
    const images = colour?.images.map((m) => mediaUrl(m)) ?? [];
    return {
      '@type': 'Product',
      sku: v.sku,
      name: `${product.title} — ${colour?.name ?? v.colourId}, ${v.size}`,
      color: colour?.name,
      size: v.size,
      image: images.length ? images : allImages.length ? allImages : undefined,
      offers: {
        '@type': 'Offer',
        url: `${url}?sku=${encodeURIComponent(v.sku)}`,
        price: paiseToAmount(v.priceOverride ?? product.price),
        priceCurrency: 'INR',
        availability,
        itemCondition: 'https://schema.org/NewCondition',
        seller: { '@id': ORG_ID },
      },
    };
  });

  return {
    '@context': 'https://schema.org',
    '@type': 'ProductGroup',
    '@id': `${url}#product`,
    productGroupID: product.id,
    name: product.title,
    description,
    url,
    brand: { '@type': 'Brand', name: BRAND },
    image: allImages.length ? allImages : undefined,
    material: product.fabric || undefined,
    audience: { '@type': 'PeopleAudience', suggestedGender: 'unisex' },
    variesBy: ['https://schema.org/color', 'https://schema.org/size'],
    hasVariant,
  };
}

export function faqLd(items: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({
      '@type': 'Question',
      name: i.q,
      acceptedAnswer: { '@type': 'Answer', text: plainText(i.a) },
    })),
  };
}
