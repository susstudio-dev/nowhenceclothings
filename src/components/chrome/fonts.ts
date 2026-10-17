import { Cormorant_Garamond, DM_Sans, DM_Serif_Display, Fraunces, Inter, Inter_Tight, Manrope, Playfair_Display } from 'next/font/google';

// Curated families (A9b, BRAND_FONTS in lib/schemas/settings). Each is
// registered as `--font-{key}`; the root layout maps the owner's choice onto
// --font-display / --font-sans at request time (lib/brand brandCssVars), so a
// font change needs no rebuild. Only the defaults are preloaded.

/** Display serif: headlines, wordmark, editorial pull quotes (default). */
export const fontDisplay = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-cormorant-garamond',
});

/** Grotesk: body, UI, labels (default). */
export const fontSans = Inter_Tight({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-inter-tight',
});

const playfair = Playfair_Display({ subsets: ['latin'], weight: ['400', '500'], display: 'swap', preload: false, variable: '--font-playfair-display' });
const fraunces = Fraunces({ subsets: ['latin'], weight: ['400', '500'], display: 'swap', preload: false, variable: '--font-fraunces' });
const dmSerif = DM_Serif_Display({ subsets: ['latin'], weight: ['400'], display: 'swap', preload: false, variable: '--font-dm-serif-display' });
const inter = Inter({ subsets: ['latin'], weight: ['400', '500'], display: 'swap', preload: false, variable: '--font-inter' });
const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '500'], display: 'swap', preload: false, variable: '--font-dm-sans' });
const manrope = Manrope({ subsets: ['latin'], weight: ['400', '500'], display: 'swap', preload: false, variable: '--font-manrope' });

/**
 * Apply to <html>: registers every curated `--font-{key}`. --font-display and
 * --font-sans are set by the root layout's brand style (defaults in globals.css).
 */
export const fontVariables = [fontDisplay, fontSans, playfair, fraunces, dmSerif, inter, dmSans, manrope]
  .map((f) => f.variable)
  .join(' ');
