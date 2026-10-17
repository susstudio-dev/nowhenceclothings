import 'server-only';
import { getCatalogue } from './catalogue';
import { getSettings } from './content';
import { pingIndexNow, resolveIndexNowKey } from './indexnow';
import { toPublicProduct, isIndexable } from './launches';
import { paths } from './seo';
import { STATIC_SLUGS } from './static-pages';
import type { CatalogueDoc } from './schemas/catalogue';
import type { LaunchDefaults } from './schemas/launches';

// Server side of IndexNow (WS-E): resolves the key, builds the changed-URL
// list and pings without making the admin request wait for it.

/** The key in force: INDEXNOW_KEY env, else Settings -> Marketing. */
export async function currentIndexNowKey(): Promise<string | null> {
  const settingsKey = await getSettings()
    .then((s) => s.seo.indexNowKey)
    .catch(() => '');
  return resolveIndexNowKey(settingsKey, process.env.INDEXNOW_KEY);
}

/** Keep the work alive after the response on Workers; plain fire-and-forget elsewhere. */
async function background(task: Promise<unknown>): Promise<void> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    getCloudflareContext().ctx.waitUntil(task);
  } catch {
    void task;
  }
}

/** Submit paths. Skipped without a key and anywhere but production, so dev and tests never ping. */
export async function notifyIndexNow(urlPaths: string[]): Promise<void> {
  if (process.env.NODE_ENV !== 'production') return;
  const key = await currentIndexNowKey();
  if (!key) return;
  await background(pingIndexNow(urlPaths, key).catch(() => null));
}

/**
 * Paths worth submitting when products change. Only active, indexable pieces:
 * coming-soon and unpublished URLs are not public, so their slugs must not
 * leak to search engines.
 */
export function productPathsToSubmit(
  cat: Pick<CatalogueDoc, 'products' | 'drops'>,
  ids: string[],
  defaults: LaunchDefaults,
  now: Date = new Date(),
): string[] {
  const out = [paths.home(), paths.shop()];
  for (const id of ids) {
    const p = cat.products.find((x) => x.id === id);
    if (!p) continue;
    // Drafts and archived pieces may never have been public: not submitted either.
    if (p.status !== 'active' || !isIndexable(toPublicProduct(p, cat.drops, defaults, now))) continue;
    out.push(paths.product(p.slug));
  }
  return out;
}

/** After a product save / status change. Never throws. */
export async function notifyProductsChanged(ids: string[]): Promise<void> {
  try {
    if (process.env.NODE_ENV !== 'production') return;
    const [cat, settings] = await Promise.all([getCatalogue(), getSettings()]);
    await notifyIndexNow(productPathsToSubmit(cat, ids, settings.launches));
  } catch {
    /* best effort */
  }
}

/** After a content publish: home, the listing and the static pages. Never throws. */
export async function notifyContentPublished(): Promise<void> {
  try {
    await notifyIndexNow([paths.home(), paths.shop(), '/coming-soon', ...STATIC_SLUGS.map((s) => paths.page(s))]);
  } catch {
    /* best effort */
  }
}
