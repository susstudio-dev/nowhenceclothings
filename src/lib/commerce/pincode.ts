// A15: PIN code → city/state, via India Post's public API (proxied by
// /api/pincode). Pure parsing here; the fetch has a timeout and an in-isolate
// cache, and every failure resolves to null so the form falls back to manual.

export interface PincodeInfo {
  pincode: string;
  city: string;
  district: string;
  state: string;
  /** Distinct post-office localities, for an optional picker. */
  areas: string[];
}

export const PINCODE_RE = /^[1-9]\d{5}$/;

interface PostOffice {
  Name?: string;
  District?: string;
  Block?: string;
  State?: string;
}

const title = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

/** Parse the India Post response shape `[{ Status, PostOffice: [...] }]`. */
export function parsePostalResponse(pin: string, body: unknown): PincodeInfo | null {
  const first = Array.isArray(body) ? (body[0] as { Status?: string; PostOffice?: PostOffice[] | null }) : null;
  if (!first || first.Status !== 'Success' || !first.PostOffice?.length) return null;
  const offices = first.PostOffice;
  const state = offices.find((o) => o.State)?.State;
  const district = offices.find((o) => o.District)?.District ?? '';
  if (!state) return null;
  const counts = new Map<string, number>();
  for (const o of offices) {
    const c = title(o.District || o.Block || '');
    if (c && c !== 'Na') counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const city = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? district;
  return {
    pincode: pin,
    city: title(city),
    district: title(district),
    state: title(state).replace(/\bAnd\b/g, 'and'),
    areas: [...new Set(offices.map((o) => o.Name).filter((n): n is string => !!n))].slice(0, 30),
  };
}

const cache = new Map<string, { at: number; value: PincodeInfo | null }>();
const TTL_HIT = 24 * 3600_000;
const TTL_MISS = 10 * 60_000;

export async function lookupPincode(
  pin: string,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number; now?: number } = {},
): Promise<PincodeInfo | null> {
  if (!PINCODE_RE.test(pin)) return null;
  const now = opts.now ?? Date.now();
  const hit = cache.get(pin);
  if (hit && now - hit.at < (hit.value ? TTL_HIT : TTL_MISS)) return hit.value;
  const f = opts.fetchImpl ?? fetch;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 3500);
  try {
    const res = await f(`https://api.postalpincode.in/pincode/${pin}`, { signal: ctl.signal, headers: { accept: 'application/json' } });
    if (!res.ok) return null; // upstream trouble: not cached
    const value = parsePostalResponse(pin, await res.json());
    cache.set(pin, { at: now, value });
    if (cache.size > 2000) cache.delete(cache.keys().next().value!);
    return value;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Test helper. */
export function clearPincodeCache(): void {
  cache.clear();
}
