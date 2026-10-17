// Shared fixtures for the SEO tests (jsonld / sitemap / indexnow): small,
// self-contained documents so the tests do not depend on data/*.json.
import { toPublicProduct } from '../launches';
import { CatalogueDoc, Product } from '../schemas/catalogue';
import { LaunchDefaults } from '../schemas/launches';
import { SettingsDoc } from '../schemas/settings';
import { SiteContentDoc } from '../schemas/site-content';

export const NOW = new Date('2026-10-17T12:00:00.000Z');
export const DEFAULTS = LaunchDefaults.parse({});

const img = (id: string) => ({ id, alt: `Photo ${id}`, width: 1600, height: 2000, widths: [640, 1600] });

/** Variants with unique SKUs (the catalogue schema rejects duplicates across products). */
export const variantsFor = (tag: string) => [
  { sku: `NWH-${tag}-S`, colourId: 'blk', size: 'S' },
  { sku: `NWH-${tag}-M`, colourId: 'blk', size: 'M' },
];

export function rawProduct(over: Record<string, unknown> = {}): Product {
  return Product.parse({
    id: 'p1',
    slug: 'polo-black',
    title: 'Ring Embroidered Polo',
    description: 'A heavyweight black polo with a tonal ring embroidered at the chest.',
    categoryId: 'tops',
    status: 'active',
    price: 149900,
    colours: [{ id: 'blk', name: 'Black', hex: '#0b0b0b', images: [img('m1'), img('m2')] }],
    sizes: ['S', 'M'],
    variants: [
      { sku: 'NWH-POLO-BLK-S', colourId: 'blk', size: 'S' },
      { sku: 'NWH-POLO-BLK-M', colourId: 'blk', size: 'M' },
    ],
    fabric: '240 gsm cotton pique',
    sizeChartId: 'sc',
    seo: {},
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-15T09:30:00.000Z',
    ...over,
  });
}

export const publicProduct = (over: Record<string, unknown> = {}, drops: CatalogueDoc['drops'] = []) =>
  toPublicProduct(rawProduct(over), drops, DEFAULTS, NOW);

export function catalogue(products: Product[], extra: Record<string, unknown> = {}): CatalogueDoc {
  return CatalogueDoc.parse({
    products,
    categories: [{ id: 'tops', slug: 'tops', name: 'Tops', seo: {} }],
    collections: [{ id: 'core', slug: 'core', name: 'Core', seo: {} }],
    ...extra,
  });
}

/** A catalogue holding already-projected products (zod parsing would strip their `launch`). */
export const storefront = (products: ReturnType<typeof publicProduct>[]): CatalogueDoc => ({ ...catalogue([]), products });

export const content = (over: Record<string, unknown> = {}) =>
  SiteContentDoc.parse({ nav: { primary: [], footer: [] }, home: { blocks: [], seo: {} }, ...over });

export const settings = (over: Record<string, unknown> = {}) =>
  SettingsDoc.parse({
    shipping: { flatFee: 9900, freeShippingThreshold: 299900 },
    store: { name: 'Nowhence', email: 'hello@nowhenceclothings.com', instagram: '@nowhence_clothings' },
    ...over,
  });
