import type { Config } from 'tailwindcss';

// Nowhence design tokens (D11). Owned by WS-A; see docs/DESIGN.md.
// Token names are stable contracts: add, never rename.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'rgb(var(--c-paper) / <alpha-value>)',
        'paper-deep': 'rgb(var(--c-paper-deep) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        'ink-soft': 'rgb(var(--c-ink-soft) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        accent: 'rgb(var(--c-accent) / <alpha-value>)',
        sale: 'rgb(var(--c-sale) / <alpha-value>)',
        success: 'rgb(var(--c-success) / <alpha-value>)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      // Strict type scale (1.25 ratio, 16px base). [size, { lineHeight, letterSpacing }]
      fontSize: {
        micro: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.14em' }],
        caption: ['0.75rem', { lineHeight: '1.125rem', letterSpacing: '0.02em' }],
        small: ['0.875rem', { lineHeight: '1.375rem' }],
        body: ['1rem', { lineHeight: '1.625rem' }],
        lead: ['1.25rem', { lineHeight: '1.875rem' }],
        h4: ['1.5625rem', { lineHeight: '2rem', letterSpacing: '-0.01em' }],
        h3: ['1.9375rem', { lineHeight: '2.375rem', letterSpacing: '-0.015em' }],
        h2: ['2.4375rem', { lineHeight: '2.75rem', letterSpacing: '-0.02em' }],
        h1: ['3.0625rem', { lineHeight: '3.375rem', letterSpacing: '-0.02em' }],
        hero: ['clamp(2.75rem, 7vw, 5.75rem)', { lineHeight: '1', letterSpacing: '-0.02em' }],
      },
      spacing: {
        gutter: 'var(--gutter)',
        section: 'var(--section)',
        header: 'var(--header-h)',
      },
      maxWidth: {
        page: '90rem',
        prose: '38rem',
      },
      borderRadius: {
        none: '0',
        sm: '2px',
        DEFAULT: '2px',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.22, 1, 0.36, 1)',
        'in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
      },
      transitionDuration: {
        fast: '150ms',
        base: '220ms',
        slow: '300ms',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-in-right': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        'slide-in-left': { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
        'slide-in-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 220ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-in-right': 'slide-in-right 300ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-in-left': 'slide-in-left 300ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-in-up': 'slide-in-up 300ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'rise-in': 'rise-in 300ms cubic-bezier(0.22, 1, 0.36, 1) both',
      },
      zIndex: { header: '40', overlay: '50' },
    },
  },
  plugins: [],
};
export default config;
