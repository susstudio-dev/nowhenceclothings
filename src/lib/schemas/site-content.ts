import { z } from 'zod';
import { Id, IsoDate, MediaRef, Seo, Slug } from './common';

export const SITE_CONTENT_KEY = 'site-content.json';
/** Draft copy edited in the studio; published by copying into SITE_CONTENT_KEY. */
export const SITE_CONTENT_DRAFT_KEY = 'drafts/site-content.json';

export const Link = z.object({ label: z.string().min(1), href: z.string().min(1) });
export type Link = z.infer<typeof Link>;

/** Editorial content blocks, used by home, lookbook, journal and static pages. */
export const Block = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('hero'),
    id: Id,
    heading: z.string(),
    subheading: z.string().default(''),
    media: MediaRef.optional(),
    videoUrl: z.string().optional(),
    cta: Link.optional(),
  }),
  z.object({ type: z.literal('richText'), id: Id, markdown: z.string() }),
  z.object({
    type: z.literal('image'),
    id: Id,
    media: MediaRef,
    caption: z.string().default(''),
    layout: z.enum(['full', 'inset', 'split-left', 'split-right']).default('full'),
  }),
  z.object({ type: z.literal('gallery'), id: Id, items: z.array(MediaRef).min(1) }),
  z.object({
    type: z.literal('productGrid'),
    id: Id,
    heading: z.string().default(''),
    productIds: z.array(Id).default([]),
    collectionId: Id.optional(),
    limit: z.number().int().positive().default(8),
  }),
  z.object({ type: z.literal('featuredDrop'), id: Id, dropId: Id }),
  z.object({
    type: z.literal('categoryTiles'),
    id: Id,
    heading: z.string().default(''),
    categoryIds: z.array(Id).default([]),
  }),
  z.object({
    type: z.literal('story'),
    id: Id,
    heading: z.string(),
    body: z.string(),
    media: MediaRef.optional(),
    cta: Link.optional(),
  }),
  z.object({ type: z.literal('quote'), id: Id, text: z.string(), attribution: z.string().default('') }),
  z.object({
    type: z.literal('faq'),
    id: Id,
    items: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
  }),
  z.object({ type: z.literal('newsletter'), id: Id, heading: z.string(), body: z.string().default('') }),
]);
export type Block = z.infer<typeof Block>;
export type BlockType = Block['type'];

export const Page = z.object({
  slug: Slug,
  title: z.string().min(1),
  blocks: z.array(Block).default([]),
  seo: Seo,
  updatedAt: IsoDate.optional(),
});
export type Page = z.infer<typeof Page>;

export const Article = Page.extend({
  /** Journal entries / lookbook chapters. */
  excerpt: z.string().default(''),
  cover: MediaRef.optional(),
  publishedAt: IsoDate.optional(),
  status: z.enum(['draft', 'published']).default('draft'),
});
export type Article = z.infer<typeof Article>;

export const NavItem = Link.extend({ children: z.array(Link).default([]) });
export type NavItem = z.infer<typeof NavItem>;

/** Static page slugs required by S9. */
export const STATIC_PAGE_SLUGS = [
  'about',
  'contact',
  'faq',
  'size-guide',
  'shipping',
  'returns',
  'privacy',
  'terms',
] as const;

export const SiteContentDoc = z.object({
  announcement: z
    .object({ enabled: z.boolean().default(false), text: z.string().default(''), href: z.string().optional() })
    .default({}),
  nav: z.object({
    primary: z.array(NavItem).default([]),
    footer: z.array(z.object({ heading: z.string(), links: z.array(Link) })).default([]),
  }),
  home: z.object({ blocks: z.array(Block).default([]), seo: Seo }),
  /** Static pages keyed by slug (see STATIC_PAGE_SLUGS). */
  pages: z.record(z.string(), Page).default({}),
  lookbook: z.array(Article).default([]),
  journal: z.array(Article).default([]),
  updatedAt: IsoDate.optional(),
  updatedBy: z.string().optional(),
});
export type SiteContentDoc = z.infer<typeof SiteContentDoc>;
