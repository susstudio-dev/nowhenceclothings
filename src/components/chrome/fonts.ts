import localFont from 'next/font/local';

// Curated families (A9b, BRAND_FONTS in lib/schemas/settings). Each is
// registered as `--font-{key}`; the root layout maps the owner's choice onto
// --font-display / --font-sans at request time (lib/brand brandCssVars), so a
// font change needs no rebuild. Only the A12 defaults (Jost + Inter Tight) are
// preloaded; the alternates load on demand. Latin subset, metric-matched
// fallbacks (adjustFontFallback) to avoid layout shift.
//
// Files are bundled in src/fonts (downloaded once from Google Fonts) rather than
// fetched by next/font/google at build time: a flaky Google response on the
// Cloudflare build machine failed a production deploy (2026-10-17).

/** Geometric display sans: headlines, editorial titles (default, A12). */
export const fontDisplay = localFont({
  src: [
    { path: '../../fonts/jost-300.woff2', weight: '300', style: 'normal' },
    { path: '../../fonts/jost-400.woff2', weight: '400', style: 'normal' },
    { path: '../../fonts/jost-500.woff2', weight: '500', style: 'normal' },
  ],
  display: 'swap',
  adjustFontFallback: 'Arial',
  fallback: ['system-ui', 'sans-serif'],
  variable: '--font-jost',
});

/** Grotesk: body, UI, labels (default). */
export const fontSans = localFont({
  src: [
    { path: '../../fonts/inter-tight-400.woff2', weight: '400', style: 'normal' },
    { path: '../../fonts/inter-tight-500.woff2', weight: '500', style: 'normal' },
  ],
  display: 'swap',
  adjustFontFallback: 'Arial',
  fallback: ['system-ui', 'sans-serif'],
  variable: '--font-inter-tight',
});

// next/font needs literal options (no spreads), hence the repetition.
const cormorant = localFont({ src: [{ path: '../../fonts/cormorant-garamond-400.woff2', weight: '400', style: 'normal' }, { path: '../../fonts/cormorant-garamond-500.woff2', weight: '500', style: 'normal' }], display: 'swap', preload: false, adjustFontFallback: 'Times New Roman', variable: '--font-cormorant-garamond' });
const playfair = localFont({ src: [{ path: '../../fonts/playfair-display-400.woff2', weight: '400', style: 'normal' }, { path: '../../fonts/playfair-display-500.woff2', weight: '500', style: 'normal' }], display: 'swap', preload: false, adjustFontFallback: 'Times New Roman', variable: '--font-playfair-display' });
const fraunces = localFont({ src: [{ path: '../../fonts/fraunces-400.woff2', weight: '400', style: 'normal' }, { path: '../../fonts/fraunces-500.woff2', weight: '500', style: 'normal' }], display: 'swap', preload: false, adjustFontFallback: 'Times New Roman', variable: '--font-fraunces' });
const dmSerif = localFont({ src: [{ path: '../../fonts/dm-serif-display-400.woff2', weight: '400', style: 'normal' }], display: 'swap', preload: false, adjustFontFallback: 'Times New Roman', variable: '--font-dm-serif-display' });
const inter = localFont({ src: [{ path: '../../fonts/inter-400.woff2', weight: '400', style: 'normal' }, { path: '../../fonts/inter-500.woff2', weight: '500', style: 'normal' }], display: 'swap', preload: false, adjustFontFallback: 'Arial', variable: '--font-inter' });
const dmSans = localFont({ src: [{ path: '../../fonts/dm-sans-400.woff2', weight: '400', style: 'normal' }, { path: '../../fonts/dm-sans-500.woff2', weight: '500', style: 'normal' }], display: 'swap', preload: false, adjustFontFallback: 'Arial', variable: '--font-dm-sans' });
const manrope = localFont({ src: [{ path: '../../fonts/manrope-400.woff2', weight: '400', style: 'normal' }, { path: '../../fonts/manrope-500.woff2', weight: '500', style: 'normal' }], display: 'swap', preload: false, adjustFontFallback: 'Arial', variable: '--font-manrope' });

/**
 * Apply to <html>: registers every curated `--font-{key}`. --font-display and
 * --font-sans are set by the root layout's brand style (defaults in globals.css).
 */
export const fontVariables = [fontDisplay, fontSans, cormorant, playfair, fraunces, dmSerif, inter, dmSans, manrope]
  .map((f) => f.variable)
  .join(' ');
