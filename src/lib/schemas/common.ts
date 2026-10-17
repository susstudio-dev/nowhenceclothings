import { z } from 'zod';

/** Integer paise (₹1 = 100). Never floats. */
export const Paise = z.number().int().nonnegative();
export type Paise = z.infer<typeof Paise>;

/** ISO-8601 timestamp string. */
export const IsoDate = z.string().datetime({ offset: true });

export const Slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lowercase-kebab slug');
export const Id = z.string().min(1).max(64);
export const Email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.string().email());

/** Indian mobile, stored as 10 digits (no +91). */
export const Phone = z.string().regex(/^[6-9]\d{9}$/, '10-digit Indian mobile');
export const Pincode = z.string().regex(/^[1-9]\d{5}$/, '6-digit PIN code');

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;
export const Size = z.enum(SIZES);
export type Size = z.infer<typeof Size>;

/** Reference to an uploaded image; variants live at media/{id}/{w}.{avif,webp}. */
export const MediaRef = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  alt: z.string().default(''),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  /** Widths generated for this image (ascending). Empty = original only. */
  widths: z.array(z.number().int().positive()).default([]),
  /** Optional direct URL (placeholders / external). Overrides media/{id} lookup. */
  src: z.string().optional(),
});
export type MediaRef = z.infer<typeof MediaRef>;

export const Seo = z
  .object({
    title: z.string().max(70).optional(),
    description: z.string().max(170).optional(),
    ogImage: MediaRef.optional(),
  })
  .default({});
export type Seo = z.infer<typeof Seo>;

export const Address = z.object({
  name: z.string().trim().min(1).max(100),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).default(''),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().min(1).max(80),
  pincode: Pincode,
  country: z.literal('IN').default('IN'),
});
export type Address = z.infer<typeof Address>;
