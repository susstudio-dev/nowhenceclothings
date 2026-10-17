import { Cormorant_Garamond, Inter_Tight } from 'next/font/google';

/** Display serif: headlines, wordmark, editorial pull quotes. */
export const fontDisplay = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-display',
});

/** Grotesk: body, UI, labels. */
export const fontSans = Inter_Tight({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-sans',
});

/** Apply to <html>: exposes --font-display and --font-sans for Tailwind's font-display/font-sans. */
export const fontVariables = `${fontDisplay.variable} ${fontSans.variable}`;
