#!/usr/bin/env node
// Wrangler's custom build for the Worker — see `build.command` in wrangler.jsonc.
// Wrangler runs this before `deploy`, `versions upload` and `dev`, immediately
// prior to checking that `main` exists.
//
// Why it's needed: `main` is `.open-next/worker.js`, which only
// `opennextjs-cloudflare build` emits — plain `next build` never does.
// Cloudflare Workers Builds runs the dashboard build command (`npm run build`
// = `next build`, which the GitHub Pages export and the quality gate both
// depend on) and then `npx wrangler versions upload`. `wrangler deploy`
// detects an OpenNext project and delegates to the OpenNext CLI, but
// `versions upload` has no such delegation — so without this, the upload dies
// with "The entry-point file at .open-next/worker.js was not found."
//
// Why it's conditional: every other path already builds before calling
// wrangler — `npm run deploy`, `npm run upload`, `npm run preview`, and
// .github/workflows/deploy-cloudflare.yml all run `opennextjs-cloudflare
// build` first, and the OpenNext deploy command *requires* that (it reads the
// compiled config out of `.open-next/`). Rebuilding on the way through would
// duplicate a multi-minute build for no gain. `.open-next/` is gitignored, so
// a fresh CI clone never has one and always takes the build path.

import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const ENTRY = '.open-next/worker.js';

if (existsSync(ENTRY)) {
  console.log(`[build-worker] ${ENTRY} present — reusing it, skipping OpenNext build.`);
  process.exit(0);
}

console.log(`[build-worker] ${ENTRY} missing — running \`opennextjs-cloudflare build\`.`);
const onWindows = process.platform === 'win32';
const { status, error } = spawnSync('npx', ['opennextjs-cloudflare', 'build'], {
  stdio: 'inherit',
  // Windows needs the shell to resolve npx.cmd off PATH.
  shell: onWindows,
});

if (error) {
  console.error(`[build-worker] could not start the OpenNext build: ${error.message}`);
  process.exit(1);
}
process.exit(status ?? 1);
