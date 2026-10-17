import { purgePathsFor } from './edge-cache';

// WS-J: drop edge-cached HTML after an admin save/publish. Only does work in
// the Workers runtime (caches.default); a no-op under next dev and tests.

export const SITE_ORIGINS = ['https://nowhenceclothings.com', 'https://www.nowhenceclothings.com'];

interface CacheLike {
  delete(req: Request | string): Promise<boolean>;
}

function defaultCache(): CacheLike | null {
  const c = (globalThis as unknown as { caches?: { default?: CacheLike } }).caches;
  return c?.default ?? null;
}

/** Delete the edge copies of the affected paths. Never throws. */
export async function purgeEdge(
  opts: { productSlugs?: string[]; extra?: string[]; origins?: string[] } = {},
  cache: CacheLike | null = defaultCache(),
): Promise<number> {
  if (!cache) return 0;
  const urls = (opts.origins ?? SITE_ORIGINS).flatMap((o) => purgePathsFor(opts).map((p) => o + p));
  const results = await Promise.all(urls.map((u) => cache.delete(new Request(u, { method: 'GET' })).catch(() => false)));
  return results.filter(Boolean).length;
}
