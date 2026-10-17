// QA F9: non-interactive ESLint for `next lint` (Next 15 flat config).
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default [
  { ignores: ['.next/**', '.open-next/**', 'node_modules/**', 'data/**', 'public/**', 'next-env.d.ts', 'custom-worker.mjs'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // QA F15: `const { secret: _x, ...rest } = doc` is how we omit fields; `_`-prefixed names are intentional.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      // QA F15: next's preset maps our custom <Image media={…}> to <img>, but it takes
      // alt from `media.alt` (see components/ui/Image.tsx, whose inner <img> is still
      // checked). Keep the rule for real DOM elements only.
      'jsx-a11y/alt-text': ['warn', { elements: ['img', 'object', 'area', 'input[type="image"]'] }],
    },
  },
];
