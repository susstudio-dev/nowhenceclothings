import bundled from '../../data/site-content.json';
import { SiteContentDoc } from './schemas/site-content';

/**
 * Bundled default site content (data/site-content.json). Used when the stored
 * doc is missing, and per section when a stored doc has an empty home page or
 * empty primary nav (live bug: an empty doc was published to production R2).
 */
export const DEFAULT_SITE_CONTENT: SiteContentDoc = SiteContentDoc.parse(bundled);

/** Fill empty critical sections from defaults. Pure. */
export function withContentFallback(
  doc: SiteContentDoc | null | undefined,
  defaults: SiteContentDoc = DEFAULT_SITE_CONTENT,
): SiteContentDoc {
  if (!doc) return defaults;
  const homeEmpty = doc.home.blocks.length === 0;
  const navEmpty = doc.nav.primary.length === 0;
  const footerEmpty = doc.nav.footer.length === 0;
  if (!homeEmpty && !navEmpty && !footerEmpty) return doc;
  return {
    ...doc,
    nav: {
      ...doc.nav,
      primary: navEmpty ? defaults.nav.primary : doc.nav.primary,
      footer: footerEmpty ? defaults.nav.footer : doc.nav.footer,
    },
    home: homeEmpty ? { ...doc.home, blocks: defaults.home.blocks } : doc.home,
  };
}

/** Publish-time warnings for the admin editor. */
export function contentPublishWarnings(doc: SiteContentDoc): string[] {
  const w: string[] = [];
  if (doc.home.blocks.length === 0) w.push('The home page has no blocks; visitors would see the bundled default home instead.');
  if (doc.nav.primary.length === 0) w.push('The primary navigation is empty; the bundled default menu will be shown instead.');
  return w;
}
