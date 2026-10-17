/**
 * Admin-entered announcement link, normalised. Site paths ("/coming-soon",
 * "#x", "?q") stay internal; http(s) / mailto / tel are external; anything
 * else (javascript:, data:, protocol-relative "//host") is dropped.
 */
export function announcementLink(href: string | undefined): { href: string; external: boolean } | undefined {
  const h = (href ?? '').trim();
  if (!h) return undefined;
  if (h.startsWith('//')) return undefined;
  if (/^[/#?]/.test(h)) return { href: h, external: false };
  if (/^(https?:\/\/[^\s]+|mailto:[^\s]+|tel:[+\d\s-]+)$/i.test(h)) {
    const internal = /^https?:\/\/(www\.)?nowhenceclothings\.com(\/|$)/i.exec(h);
    return internal ? { href: h.slice(internal[0].length - (internal[2] === '/' ? 1 : 0)) || '/', external: false } : { href: h, external: true };
  }
  // Bare relative path typed without the leading slash ("coming-soon").
  if (/^[a-z0-9][a-z0-9/_-]*$/i.test(h)) return { href: `/${h}`, external: false };
  return undefined;
}
