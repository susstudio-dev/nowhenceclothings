import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache';

// Public pages render per-request on Workers (see the connection() call in
// src/app/layout.tsx), so no ISR queue / tag cache is needed. The R2
// incremental cache still backs Next's fetch cache and any prerendered
// metadata routes.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
});
