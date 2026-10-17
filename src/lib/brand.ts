// A9 owner customisation: pure helpers for brand colours/fonts, WCAG contrast
// and the launch-readiness checklist. No server-only imports (used by admin UI).
import { BRAND_FONTS, DEFAULT_BRAND_COLOURS, type BrandFont, type SettingsDoc } from './schemas/settings';

export const BRAND_FONT_LABELS: Record<BrandFont, { label: string; kind: 'serif' | 'sans' }> = {
  'cormorant-garamond': { label: 'Cormorant Garamond', kind: 'serif' },
  'playfair-display': { label: 'Playfair Display', kind: 'serif' },
  fraunces: { label: 'Fraunces', kind: 'serif' },
  'dm-serif-display': { label: 'DM Serif Display', kind: 'serif' },
  'inter-tight': { label: 'Inter Tight', kind: 'sans' },
  inter: { label: 'Inter', kind: 'sans' },
  'dm-sans': { label: 'DM Sans', kind: 'sans' },
  manrope: { label: 'Manrope', kind: 'sans' },
  jost: { label: 'Jost', kind: 'sans' },
};
export { BRAND_FONTS };

/** `#rrggbb` -> [r, g, b] (0–255), or null when malformed. */
export function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function channelLum(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance. */
export function relativeLuminance(rgb: [number, number, number]): number {
  return 0.2126 * channelLum(rgb[0]) + 0.7152 * channelLum(rgb[1]) + 0.0722 * channelLum(rgb[2]);
}

/** WCAG contrast ratio between two hex colours (1–21). NaN when either is malformed. */
export function contrastRatio(a: string, b: string): number {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return NaN;
  const la = relativeLuminance(ra);
  const lb = relativeLuminance(rb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export type ContrastGrade = 'AAA' | 'AA' | 'AA-large' | 'fail';
export function contrastGrade(ratio: number): ContrastGrade {
  if (!(ratio >= 3)) return 'fail';
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  return 'AA-large';
}

export interface ContrastCheck {
  id: 'ink-paper' | 'accent-paper' | 'paper-ink';
  label: string;
  ratio: number;
  grade: ContrastGrade;
  /** Minimum this pair needs. */
  min: number;
  ok: boolean;
}

/** Checks for the brand palette: body text needs 4.5:1; accent (UI / large text) 3:1. */
export function brandContrastChecks(c: { ink: string; paper: string; accent: string }): ContrastCheck[] {
  const mk = (id: ContrastCheck['id'], label: string, a: string, b: string, min: number): ContrastCheck => {
    const ratio = contrastRatio(a, b);
    return { id, label, ratio, grade: contrastGrade(ratio), min, ok: ratio >= min };
  };
  return [
    mk('ink-paper', 'Text on page (ink / paper)', c.ink, c.paper, 4.5),
    mk('accent-paper', 'Accent on page (accent / paper)', c.accent, c.paper, 3),
  ];
}

const rgbStr = (rgb: [number, number, number]) => rgb.map((x) => Math.round(x)).join(' ');
const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] =>
  [0, 1, 2].map((i) => a[i] * t + b[i] * (1 - t)) as [number, number, number];

/**
 * CSS custom properties for the storefront (globals.css token channels plus
 * font aliases). Derived tones are only overridden when the owner changed the
 * palette, so the tuned defaults stay exact.
 */
export function brandCssVars(brand: SettingsDoc['brand']): Record<string, string> {
  const vars: Record<string, string> = {
    '--font-display': `var(--font-${brand.displayFont})`,
    '--font-sans': `var(--font-${brand.bodyFont})`,
  };
  const { ink, paper, accent } = brand.colours;
  const isDefault =
    ink.toLowerCase() === DEFAULT_BRAND_COLOURS.ink &&
    paper.toLowerCase() === DEFAULT_BRAND_COLOURS.paper &&
    accent.toLowerCase() === DEFAULT_BRAND_COLOURS.accent;
  if (isDefault) return vars;
  const i = hexToRgb(ink);
  const p = hexToRgb(paper);
  const a = hexToRgb(accent);
  if (!i || !p || !a) return vars;
  vars['--c-ink'] = rgbStr(i);
  vars['--c-paper'] = rgbStr(p);
  vars['--c-accent'] = rgbStr(a);
  vars['--c-ink-soft'] = rgbStr(mix(i, p, 0.82));
  vars['--c-muted'] = rgbStr(mix(i, p, 0.62));
  vars['--c-line'] = rgbStr(mix(i, p, 0.12));
  vars['--c-paper-deep'] = rgbStr(mix(i, p, 0.05));
  return vars;
}

/** Inline-style string for `:root` (server-rendered into the root layout). */
export function brandCssText(brand: SettingsDoc['brand']): string {
  return `:root{${Object.entries(brandCssVars(brand))
    .map(([k, v]) => `${k}:${v}`)
    .join(';')}}`;
}

/** "Sender Name <addr@x>" from email settings; falls back to `from` as stored. */
export function emailFromHeader(email: SettingsDoc['email']): string {
  const from = email.from.trim();
  const name = email.senderName.trim().replace(/["<>]/g, '');
  if (!name) return from;
  const addr = /<([^>]+)>/.exec(from)?.[1] ?? from;
  return `${name} <${addr}>`;
}

export type SettingsTab = 'brand' | 'shipping' | 'returns' | 'legal' | 'email' | 'launches';
export interface ReadinessItem {
  id: string;
  label: string;
  tab: SettingsTab;
  ok: boolean;
}

const filled = (s: string | undefined) => !!s && s.trim().length > 0;

/** Launch-readiness checklist (A9): every required owner fact, done or not. */
export function launchReadiness(s: SettingsDoc): ReadinessItem[] {
  const contrastOk = brandContrastChecks(s.brand.colours).every((c) => c.ok);
  const items: ReadinessItem[] = [
    { id: 'brand.wordmark', label: 'Wordmark or logo', tab: 'brand', ok: filled(s.brand.wordmark) || !!s.brand.logoLight },
    { id: 'brand.favicon', label: 'Favicon', tab: 'brand', ok: !!s.brand.favicon },
    { id: 'brand.contrast', label: 'Brand colours pass contrast', tab: 'brand', ok: contrastOk },
    { id: 'shipping.eta', label: 'Delivery estimate copy', tab: 'shipping', ok: filled(s.shipping.eta) },
    { id: 'store.email', label: 'Contact email', tab: 'legal', ok: filled(s.store.email) },
    { id: 'store.phone', label: 'Contact phone', tab: 'legal', ok: filled(s.store.phone) },
    { id: 'store.address', label: 'Contact / studio address', tab: 'legal', ok: filled(s.store.address) },
    { id: 'returns.policy', label: 'Returns policy text', tab: 'returns', ok: filled(s.returns.policyMarkdown) },
    { id: 'legal.legalName', label: 'Legal company name', tab: 'legal', ok: filled(s.legal.legalName) },
    { id: 'legal.gstin', label: 'GSTIN', tab: 'legal', ok: /^[0-9A-Z]{15}$/.test(s.legal.gstin) },
    { id: 'legal.registeredAddress', label: 'Registered address', tab: 'legal', ok: filled(s.legal.registeredAddress) },
    { id: 'legal.jurisdictionCity', label: 'Jurisdiction city', tab: 'legal', ok: filled(s.legal.jurisdictionCity) },
    { id: 'legal.privacyUpdatedAt', label: 'Privacy policy date', tab: 'legal', ok: filled(s.legal.privacyUpdatedAt) },
    { id: 'legal.termsUpdatedAt', label: 'Terms date', tab: 'legal', ok: filled(s.legal.termsUpdatedAt) },
    { id: 'email.from', label: 'Email from-address', tab: 'email', ok: /@/.test(s.email.from) },
    { id: 'email.senderName', label: 'Email sender name', tab: 'email', ok: filled(s.email.senderName) },
    { id: 'email.replyTo', label: 'Email reply-to', tab: 'email', ok: /@/.test(s.email.replyTo) },
  ];
  return items;
}

/** Only the items still missing. */
export function missingForLaunch(s: SettingsDoc): ReadinessItem[] {
  return launchReadiness(s).filter((i) => !i.ok);
}

/** `2026-10-17` -> `17 October 2026`; empty stays empty. */
export function formatLegalDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '';
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const mi = Number(m[2]) - 1;
  if (mi < 0 || mi > 11) return '';
  return `${Number(m[3])} ${months[mi]} ${m[1]}`;
}

export interface FaviconAsset {
  /** Pixel size of what /icon.png actually returns (the manifest must declare this). */
  width: number;
  height: number;
  type: string;
  /** Stored WebP width to stream for an uploaded favicon; absent for a direct `src`. */
  mediaWidth?: number;
}

const ICON_TYPES: Record<string, string> = { png: 'image/png', webp: 'image/webp', avif: 'image/avif', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', ico: 'image/x-icon' };

/**
 * What /icon.png serves for an uploaded favicon (A9b): a direct `src` as is,
 * else the smallest stored WebP width >= 192. Shared by the route and the web
 * manifest so the declared `sizes` always match the real file.
 */
export function faviconAsset(fav: { width: number; height: number; widths?: number[]; src?: string }): FaviconAsset {
  if (fav.src) {
    const ext = /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(fav.src)?.[1]?.toLowerCase() ?? '';
    return { width: fav.width, height: fav.height, type: ICON_TYPES[ext] ?? 'image/png' };
  }
  const widths = fav.widths?.length ? [...fav.widths].sort((a, b) => a - b) : [fav.width];
  const w = widths.find((x) => x >= 192) ?? widths[widths.length - 1];
  return { width: w, height: Math.max(1, Math.round((w * fav.height) / fav.width)), type: 'image/webp', mediaWidth: w };
}

/** Manifest `sizes` for an icon ("any" for SVG). */
export function iconSizes(a: Pick<FaviconAsset, 'width' | 'height' | 'type'>): string {
  return a.type === 'image/svg+xml' ? 'any' : `${a.width}x${a.height}`;
}
