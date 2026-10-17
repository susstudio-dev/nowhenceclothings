// Pure helpers for the content studio (A6): version keys and draft diffing.
import type { SiteContentDoc } from '@/lib/schemas/site-content';

export const CONTENT_VERSION_DOC = 'site-content';
export const CONTENT_VERSIONS_PREFIX = `versions/${CONTENT_VERSION_DOC}/`;

/** Editable top-level sections of the site content. */
export const CONTENT_SECTIONS = ['announcement', 'nav', 'home', 'pages', 'lookbook', 'journal'] as const;
export type ContentSection = (typeof CONTENT_SECTIONS)[number];

function body(doc: SiteContentDoc): Record<string, unknown> {
  const { updatedAt: _u, updatedBy: _b, ...rest } = doc;
  return rest;
}

/** Sections that differ between draft and published ("unpublished changes"). */
export function changedSections(draft: SiteContentDoc, published: SiteContentDoc): ContentSection[] {
  const d = body(draft);
  const p = body(published);
  return CONTENT_SECTIONS.filter((s) => JSON.stringify(d[s]) !== JSON.stringify(p[s]));
}

/** Only real snapshot keys may be restored (no arbitrary object reads). */
export function isContentVersionKey(key: string): boolean {
  return /^versions\/site-content\/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.json$/.test(key);
}

/** "versions/site-content/2026-10-17T10-00-00-000Z.json" -> ISO time ('' if not a version key). */
export function versionTime(key: string): string {
  const m = /(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/.exec(key);
  return m ? `${m[1]}T${m[2]}:${m[3]}:${m[4]}.${m[5]}Z` : '';
}
