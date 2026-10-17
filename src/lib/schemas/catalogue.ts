import { z } from 'zod';
import { Id, IsoDate, MediaRef, Paise, Seo, Size, Slug } from './common';
import { Availability, ComingSoonConfig, PresaleConfig } from './launches';

export const CATALOGUE_KEY = 'catalogue.json';

export const Colour = z.object({
  id: Id,
  name: z.string().min(1),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  images: z.array(MediaRef).default([]),
});
export type Colour = z.infer<typeof Colour>;

export const Variant = z.object({
  sku: z.string().regex(/^[A-Z0-9-]{3,40}$/),
  colourId: Id,
  size: Size,
  priceOverride: Paise.optional(),
  compareAtPriceOverride: Paise.optional(),
});
export type Variant = z.infer<typeof Variant>;

export const ProductStatus = z.enum(['draft', 'active', 'archived']);
export type ProductStatus = z.infer<typeof ProductStatus>;

export const Product = z.object({
  id: Id,
  slug: Slug,
  title: z.string().min(1).max(120),
  description: z.string().default(''),
  categoryId: Id,
  collectionIds: z.array(Id).default([]),
  dropId: Id.optional(),
  status: ProductStatus,
  /** GST-inclusive price in paise. */
  price: Paise,
  /** Strike-through price; sale is active while compareAtPrice > price and saleEndsAt is unset or future. */
  compareAtPrice: Paise.optional(),
  saleEndsAt: IsoDate.optional(),
  colours: z.array(Colour).min(1),
  sizes: z.array(Size).min(1),
  variants: z.array(Variant).min(1),
  fabric: z.string().default(''),
  care: z.string().default(''),
  fit: z.string().default(''),
  sizeChartId: Id,
  /** Product ids for "complete the look". */
  relatedIds: z.array(Id).default([]),
  /** Lower sorts first within merchandising lists. */
  sortOrder: z.number().int().default(0),
  seo: Seo,
  /** A10/A11. Absent on older docs = 'available'. */
  availability: Availability.optional(),
  comingSoon: ComingSoonConfig.optional(),
  presale: PresaleConfig.optional(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
});
export type Product = z.infer<typeof Product>;

export const Category = z.object({
  id: Id,
  slug: Slug,
  name: z.string().min(1),
  description: z.string().default(''),
  image: MediaRef.optional(),
  sortOrder: z.number().int().default(0),
  seo: Seo,
});
export type Category = z.infer<typeof Category>;

export const Collection = z.object({
  id: Id,
  slug: Slug,
  name: z.string().min(1),
  description: z.string().default(''),
  heroMedia: MediaRef.optional(),
  sortOrder: z.number().int().default(0),
  seo: Seo,
});
export type Collection = z.infer<typeof Collection>;

export const Drop = z.object({
  id: Id,
  name: z.string().min(1),
  slug: Slug,
  releaseAt: IsoDate,
  heroMedia: MediaRef.optional(),
  description: z.string().default(''),
  seo: Seo,
  /** A11 drop-level presale; products in the drop inherit it unless they enable their own. */
  presale: PresaleConfig.optional(),
});
export type Drop = z.infer<typeof Drop>;

/** Unisex size chart; measurements in cm (UI converts to inches). */
export const SizeChart = z.object({
  id: Id,
  name: z.string().min(1),
  /** e.g. ['chest', 'length', 'shoulder', 'sleeve'] */
  measurements: z.array(z.string().min(1)).min(1),
  rows: z.array(
    z.object({
      size: Size,
      values: z.record(z.string(), z.number().nonnegative()),
    }),
  ),
  /** "Model is 183 cm wearing M" */
  modelNote: z.string().default(''),
});
export type SizeChart = z.infer<typeof SizeChart>;

export const CatalogueDoc = z
  .object({
    version: z.number().int().nonnegative().default(1),
    products: z.array(Product).default([]),
    categories: z.array(Category).default([]),
    collections: z.array(Collection).default([]),
    drops: z.array(Drop).default([]),
    sizeCharts: z.array(SizeChart).default([]),
  })
  .superRefine((doc, ctx) => {
    const skus = new Set<string>();
    const slugs = new Set<string>();
    doc.products.forEach((p, i) => {
      if (slugs.has(p.slug)) ctx.addIssue({ code: 'custom', path: ['products', i, 'slug'], message: `duplicate slug ${p.slug}` });
      slugs.add(p.slug);
      const colourIds = new Set(p.colours.map((c) => c.id));
      p.variants.forEach((v, j) => {
        if (skus.has(v.sku)) ctx.addIssue({ code: 'custom', path: ['products', i, 'variants', j, 'sku'], message: `duplicate sku ${v.sku}` });
        skus.add(v.sku);
        if (!colourIds.has(v.colourId)) ctx.addIssue({ code: 'custom', path: ['products', i, 'variants', j, 'colourId'], message: 'unknown colourId' });
        if (!p.sizes.includes(v.size)) ctx.addIssue({ code: 'custom', path: ['products', i, 'variants', j, 'size'], message: 'size not in product.sizes' });
      });
    });
  });
export type CatalogueDoc = z.infer<typeof CatalogueDoc>;
