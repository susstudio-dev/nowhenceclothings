// F18: tests never touch data/. Each worker gets its own temp data root,
// seeded with copies of the top-level data/*.json docs, and storage.ts reads
// NOWHENCE_DATA_DIR at import time.
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const id = process.env.VITEST_POOL_ID ?? process.env.VITEST_WORKER_ID ?? String(process.pid);
const dir = path.join(os.tmpdir(), `nowhence-test-data-${process.pid}-${id}`);
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
  const src = path.join(process.cwd(), 'data');
  for (const f of readdirSync(src)) if (f.endsWith('.json')) cpSync(path.join(src, f), path.join(dir, f));
}
process.env.NOWHENCE_DATA_DIR = dir;
