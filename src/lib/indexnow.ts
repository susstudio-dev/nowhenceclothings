import { CANONICAL_HOST, SITE_URL, absoluteUrl, canonicalUrl } from './seo';

// IndexNow (WS-E): tell Bing, Yandex and partners when a URL changes. Pure
// helpers plus a fire-and-forget ping. No key configured = nothing happens.
// https://www.indexnow.org/documentation

export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/IndexNow';
export const INDEXNOW_KEY_RE = /^[A-Za-z0-9-]{8,128}$/;
/** The protocol allows 10,000 URLs per request; we never need near that. */
const MAX_URLS = 100;

export function isValidIndexNowKey(key: string | null | undefined): key is string {
  return !!key && INDEXNOW_KEY_RE.test(key);
}

/** The env var wins (secret on the deployment); otherwise the key saved in Settings -> Marketing. Invalid keys count as none. */
export function resolveIndexNowKey(settingsKey: string | undefined, envKey: string | undefined): string | null {
  for (const k of [envKey?.trim(), settingsKey?.trim()]) if (isValidIndexNowKey(k)) return k;
  return null;
}

/** Where the key file lives; must be on the host being submitted. */
export function indexNowKeyLocation(key: string): string {
  return `${SITE_URL}/${key}.txt`;
}

/** Absolute, de-duplicated, canonical-host URLs (anything else is dropped), capped. */
export function indexNowUrls(paths: string[]): string[] {
  const out = new Set<string>();
  for (const p of paths) {
    try {
      // canonicalUrl would rewrite a foreign host to ours, so check the host first.
      if (/^https?:\/\//i.test(p) && new URL(p).host !== CANONICAL_HOST) continue;
      out.add(canonicalUrl(absoluteUrl(p)));
    } catch {
      /* skip */
    }
  }
  return [...out].slice(0, MAX_URLS);
}

export function indexNowPayload(key: string, urls: string[]) {
  return { host: CANONICAL_HOST, key, keyLocation: indexNowKeyLocation(key), urlList: urls };
}

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ status: number }>;

/**
 * POST the changed URLs. Never throws; resolves to the HTTP status, or null
 * when skipped (no valid key, no URLs) or the request failed.
 */
export async function pingIndexNow(
  paths: string[],
  key: string | null,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<number | null> {
  if (!isValidIndexNowKey(key)) return null;
  const urls = indexNowUrls(paths);
  if (!urls.length) return null;
  try {
    const res = await fetchImpl(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(indexNowPayload(key, urls)),
    });
    return res.status;
  } catch {
    return null;
  }
}
