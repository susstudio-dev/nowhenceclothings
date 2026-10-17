import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests cover the pure logic that can silently corrupt the content
// document or silently grant access: path parsing, patch application, op
// expansion, authorization, seed merging and the compare-and-swap decision.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Server modules import `server-only`, which throws on import outside a
      // server bundle. Stubbed so storage-level integration tests can run.
      'server-only': fileURLToPath(new URL('./src/lib/__stubs__/server-only.ts', import.meta.url)),
    },
  },
});
