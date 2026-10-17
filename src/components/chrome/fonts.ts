import { Cormorant_Garamond, DM_Sans, DM_Serif_Display, Fraunces, Inter, Inter_Tight, Jost, Manrope, Playfair_Display } from 'next/font/google';

// Curated families (A9b, BRAND_FONTS in lib/schemas/settings). Each is
// registered as `--font-{key}`; the root layout maps the owner's choice onto
// --font-display / --font-sans at request time (lib/brand brandCssVars), so a
// font change needs no rebuild. Only the A12 defaults (Jost + Inter Tight) are
// preloaded; the alternates load on demand. Two weights each, latin only,
// metric-matched fallbacks (adjustFontFallback) to avoid layout shift.

/** Geometric display sans: headlines, editorial titles (default, A12). */
export const fontDisplay = Jost({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  adjustFontFallback: true,
  fallback: ['system-ui', 'sans-serif'],
  variable: '--font-jost',
});

/** Grotesk: body, UI, labels (default). */
export const fontSans = Inter_Tight({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  adjustFontFallback: true,
  fallback: ['system-ui', 'sans-serif'],
  variable: '--font-inter-tight',
});

// next/font needs literal options (no spreads), hence the repetition.
const cormorant = Cormorant_Garamond({ subsets: ['latin'], display: 'swap', preload: false, adjustFontFallback: true, weight: ['400', '500'], variable: '--font-cormorant-garamond' });
const playfair = Playfair_Display({ subsets: ['latin'], display: 'swap', preload: false, adjustFontFallback: true, weight: ['400', '500'], variable: '--font-playfair-display' });
const fraunces = Fraunces({ subsets: ['latin'], display: 'swap', preload: false, adjustFontFallback: true, weight: ['400', '500'], variable: '--font-fraunces' });
const dmSerif = DM_Serif_Display({ subsets: ['latin'], display: 'swap', preload: false, adjustFontFallback: true, weight: ['400'], variable: '--font-dm-serif-display' });
const inter = Inter({ subsets: ['latin'], display: 'swap', preload: false, adjustFontFallback: true, weight: ['400', '500'], variable: '--font-inter' });
const dmSans = DM_Sans({ subsets: ['latin'], display: 'swap', preload: false, adjustFontFallback: true, weight: ['400', '500'], variable: '--font-dm-sans' });
const manrope = Manrope({ subsets: ['latin'], display: 'swap', preload: false, adjustFontFallback: true, weight: ['400', '500'], variable: '--font-manrope' });

/**
 * Apply to <html>: registers every curated `--font-{key}`. --font-display and
 * --font-sans are set by the root layout's brand style (defaults in globals.css).
 */
export const fontVariables = [fontDisplay, fontSans, cormorant, playfair, fraunces, dmSerif, inter, dmSans, manrope]
  .map((f) => f.variable)
  .join(' ');
