// QA F9: non-interactive ESLint for `next lint` (Next 15 flat config).
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default [
  { ignores: ['.next/**', '.open-next/**', 'node_modules/**', 'data/**', 'public/**', 'next-env.d.ts', 'custom-worker.mjs'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
];
