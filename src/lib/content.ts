import 'server-only';
import { readJson } from './storage';
import { SITE_CONTENT_DRAFT_KEY, SITE_CONTENT_KEY, SiteContentDoc } from './schemas/site-content';
import { withContentFallback } from './content-defaults';
import { SETTINGS_KEY, SettingsDoc } from './schemas/settings';

const DEFAULT_SETTINGS: SettingsDoc = SettingsDoc.parse({
  shipping: { flatFee: 9900, freeShippingThreshold: 299900, eta: '' },
  tax: {},
  store: { email: 'hello@nowhenceclothings.com' },
});

/** Published site content (or the draft for admin preview). */
export async function getSiteContent(opts: { draft?: boolean } = {}): Promise<SiteContentDoc> {
  if (opts.draft) {
    const draft = await readJson(SITE_CONTENT_DRAFT_KEY, SiteContentDoc);
    if (draft) return withContentFallback(draft);
  }
  // Missing doc, or a stored doc with an empty home/nav, falls back per
  // section to the bundled defaults (data/site-content.json).
  return withContentFallback(await readJson(SITE_CONTENT_KEY, SiteContentDoc));
}

/** Store settings (shipping, tax, store info). Defaults when absent. */
export async function getSettings(): Promise<SettingsDoc> {
  return (await readJson(SETTINGS_KEY, SettingsDoc)) ?? DEFAULT_SETTINGS;
}
