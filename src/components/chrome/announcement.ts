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

/** The header status line (the announcement, folded into the header). */
export interface HeaderAnnouncement {
  text: string;
  href?: string;
  external?: boolean;
  /** Quiet second part, e.g. "Sale opens 31 Oct". */
  note?: string;
}

/** The open pre-order piece the status may point at when the owner set no link. */
export interface PresaleTarget {
  slug: string;
  /** Already formatted, e.g. "Sale opens 31 Oct". */
  note?: string;
}

const PRESALE_WORDS = /pre[\s-]?order|reserv|book|deposit|presale|pre[\s-]?sale/i;

/**
 * site-content `announcement` -> header status. Undefined when disabled or blank.
 * An owner link always wins. With no link and an open pre-order piece, the
 * status points at that piece, and carries its date only when the text is
 * about pre-orders (so "Free shipping" never gains a sale date).
 */
export function resolveAnnouncement(
  a: { enabled: boolean; text: string; href?: string },
  presale?: PresaleTarget,
): HeaderAnnouncement | undefined {
  const text = a.text.trim();
  if (!a.enabled || !text) return undefined;
  const link = announcementLink(a.href);
  if (link) return { text, href: link.href, external: link.external };
  if (!presale) return { text };
  const note = presale.note && PRESALE_WORDS.test(text) && !/\d/.test(text) ? presale.note : undefined;
  return { text, href: `/products/${presale.slug}`, external: false, ...(note ? { note } : {}) };
}

/** "31 Oct" in India time (stable across server and browser). */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).format(d);
}
