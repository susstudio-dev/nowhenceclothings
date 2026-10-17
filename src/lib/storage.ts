import 'server-only';
import { promises as fs } from 'fs';
import path from 'path';
import type { ZodType, ZodTypeDef } from 'zod';
import { hashOf, mayWrite, newLineage, parseMeta } from './storage-version-core';

// Unified storage. In dev (`next dev`, plain Node) everything lives on the
// local filesystem exactly as before. In production on Cloudflare Workers the
// CONTENT_BUCKET R2 binding (see wrangler.jsonc) holds JSON docs, version
// snapshots and uploaded images — the Workers runtime has no writable disk.
// R2 is strongly consistent, so reads immediately see the latest write.

const DATA_DIR = path.join(process.cwd(), 'data');
const PUBLIC_UPLOADS = path.join(process.cwd(), 'public', 'uploads');

// Minimal structural types for the R2 binding — avoids depending on
// @cloudflare/workers-types (whose globals can clash with DOM lib types).
interface R2ObjectBody {
  key: string;
  uploaded: string | Date;
  // Unquoted form — this is what onlyIf accepts. `httpEtag` is the quoted
  // header form and can carry a weak W/ prefix that R2 rejects on the way back
  // in, so it is deliberately not modelled here.
  etag: string;
  /** Object size in bytes — sent as content-length when serving uploads. */
  size: number;
  customMetadata?: Record<string, string>;
  httpMetadata?: { contentType?: string };
  body: ReadableStream;
  text(): Promise<string>;
}
interface R2ListResult {
  objects: { key: string; uploaded: string | Date }[];
  truncated: boolean;
  cursor?: string;
}
export interface R2BucketLike {
  get(key: string): Promise<R2ObjectBody | null>;
  put(
    key: string,
    value: string | ArrayBuffer | Uint8Array,
    opts?: {
      httpMetadata?: { contentType?: string };
      customMetadata?: Record<string, string>;
      // Conditional write. When the precondition fails R2 resolves put() to
      // NULL — it does not throw and it does not surface a 412 the way the S3
      // API does, so callers must test the result explicitly.
      onlyIf?: { etagMatches?: string; etagDoesNotMatch?: string };
    },
  ): Promise<{ etag: string } | null>;
  delete(key: string): Promise<void>;
  list(opts?: { prefix?: string; limit?: number; cursor?: string }): Promise<R2ListResult>;
}

// Thrown when a write is attempted with no persistent store available
// (running on Cloudflare without the R2 binding configured).
export class StorageUnavailableError extends Error {
  constructor() {
    super(
      'Saving needs the R2 bucket binding. Check wrangler.jsonc: r2_buckets must bind CONTENT_BUCKET to your bucket (create it with `wrangler r2 bucket create nowhence-content`), then redeploy.',
    );
    this.name = 'StorageUnavailableError';
  }
}

// Resolve the R2 bucket for this request, or null when running on the local
// filesystem. Three situations:
//  - `next dev` / plain Node (NODE_ENV !== production)      → null (fs)
//  - `next build` prerendering (no Cloudflare context)      → null (fs/seed)
//  - Workers runtime (OpenNext)                             → the binding
// `inWorkerRuntime` distinguishes "no binding because we're not on Cloudflare"
// from "on Cloudflare but misconfigured" — the latter must fail loudly on
// writes instead of silently attempting fs writes that cannot persist.
async function resolveBucket(): Promise<{ bucket: R2BucketLike | null; inWorkerRuntime: boolean }> {
  if (process.env.NODE_ENV !== 'production') return { bucket: null, inWorkerRuntime: false };
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = getCloudflareContext();
    const bucket = (ctx.env as { CONTENT_BUCKET?: R2BucketLike }).CONTENT_BUCKET ?? null;
    return { bucket, inWorkerRuntime: true };
  } catch {
    // Not running inside the OpenNext worker (e.g. build-time prerender).
    return { bucket: null, inWorkerRuntime: false };
  }
}

/** On Workers with the binding MISSING, reads silently fall through to a
 *  filesystem that cannot exist there — callers who must distinguish "no
 *  document yet" from "the store is broken" check this first. */
export async function storageMisconfigured(): Promise<boolean> {
  const { bucket, inWorkerRuntime } = await resolveBucket();
  return inWorkerRuntime && bucket == null;
}

/** True when a remote (R2) store backs this request — i.e. prod on Workers. */
export async function isRemoteStorage(): Promise<boolean> {
  const { bucket } = await resolveBucket();
  return bucket != null;
}

// ---- JSON / text documents -------------------------------------------------

export async function readText(key: string): Promise<string | null> {
  const { bucket } = await resolveBucket();
  if (bucket) {
    const obj = await bucket.get(key);
    return obj == null ? null : obj.text();
  }
  try {
    return await withKeyLock(key, () => fs.readFile(path.join(DATA_DIR, key), 'utf8'));
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return null;
    throw err;
  }
}

export async function writeText(key: string, value: string): Promise<void> {
  const { bucket, inWorkerRuntime } = await resolveBucket();
  if (bucket) {
    await bucket.put(key, value, {
      httpMetadata: { contentType: 'application/json; charset=utf-8' },
    });
    return;
  }
  if (inWorkerRuntime) throw new StorageUnavailableError();
  const full = path.join(DATA_DIR, key);
  await withKeyLock(key, async () => {
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, value, 'utf8');
  });
}

export async function readJSON<T>(key: string): Promise<T | null> {
  const raw = await readText(key);
  return raw == null ? null : (JSON.parse(raw) as T);
}

export async function writeJSON(key: string, data: unknown): Promise<void> {
  await writeText(key, JSON.stringify(data, null, 2));
}

// ---- versioned documents (compare-and-swap) --------------------------------
// The write path for the content document must never read through the 30s
// per-isolate cache in content.ts: a stale cached read makes a stale base
// version MATCH, so the conflict check passes and the save silently clobbers
// whoever wrote in between. These two functions always hit the store directly.

export interface DocVersion {
  lineage: string;
  rev: number;
  /** R2's etag in production; a content hash on the dev filesystem. */
  etag: string;
}

const META_DIR = path.join(DATA_DIR, '.meta');

function sidecarPath(key: string): string {
  return path.join(META_DIR, `${key.replace(/[\\/]/g, '__')}.json`);
}

async function readSidecar(key: string): Promise<{ lineage: string; rev: number } | null> {
  try {
    return JSON.parse(await fs.readFile(sidecarPath(key), 'utf8'));
  } catch {
    return null;
  }
}

/** Reads a document together with the version token needed to write it back.
 *  Returns null when the document does not exist yet. */
export async function readDocWithVersion(
  key: string,
): Promise<{ text: string; version: DocVersion } | null> {
  const { bucket } = await resolveBucket();

  if (bucket) {
    const obj = await bucket.get(key);
    if (obj == null) return null;
    const meta = parseMeta(obj.customMetadata);
    return { text: await obj.text(), version: { ...meta, etag: obj.etag } };
  }

  let text: string;
  try {
    // Under the key lock so a read never observes a half-written file.
    text = await withKeyLock(key, () => fs.readFile(path.join(DATA_DIR, key), 'utf8'));
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return null;
    throw err;
  }
  const meta = (await readSidecar(key)) ?? { lineage: 'legacy', rev: 0 };
  return { text, version: { ...meta, etag: hashOf(text) } };
}

/** Writes only if the stored document is still the one `expected` describes.
 *  Returns the new version, or NULL when someone else wrote first.
 *  `lineage` starts a new lineage (used by restore, so every outstanding
 *  version token fails loudly instead of applying to unrelated content). */
export async function writeDocIfMatch(
  key: string,
  text: string,
  expected: DocVersion,
  opts: { lineage?: string } = {},
): Promise<DocVersion | null> {
  const lineage = opts.lineage ?? expected.lineage;
  const rev = expected.rev + 1;
  const { bucket, inWorkerRuntime } = await resolveBucket();

  if (bucket) {
    const res = await bucket.put(key, text, {
      httpMetadata: { contentType: 'application/json; charset=utf-8' },
      customMetadata: { lineage, rev: String(rev) },
      onlyIf: { etagMatches: expected.etag },
    });
    if (res === null) return null; // precondition failed — it does not throw
    return { lineage, rev, etag: res.etag };
  }

  if (inWorkerRuntime) throw new StorageUnavailableError();

  // Dev/filesystem: compare the bytes on disk against what the caller read.
  // The compare+write is serialised per key in-process (withKeyLock) so
  // concurrent requests in one `next dev` process cannot lose updates.
  return withKeyLock(key, async () => {
    const full = path.join(DATA_DIR, key);
    let current: string | null = null;
    try {
      current = await fs.readFile(full, 'utf8');
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') throw err;
    }
    if (current !== null && !mayWrite(current, { hash: expected.etag })) return null;

    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, text, 'utf8');
    await fs.mkdir(META_DIR, { recursive: true });
    await fs.writeFile(sidecarPath(key), JSON.stringify({ lineage, rev }, null, 2), 'utf8');
    return { lineage, rev, etag: hashOf(text) };
  });
}

// Per-key in-process mutex for the dev filesystem backend.
const keyLocks = new Map<string, Promise<unknown>>();
function withKeyLock<R>(key: string, fn: () => Promise<R>): Promise<R> {
  const prev = keyLocks.get(key) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  const tail = run.catch(() => undefined);
  keyLocks.set(key, tail);
  void tail.then(() => {
    if (keyLocks.get(key) === tail) keyLocks.delete(key);
  });
  return run;
}

// ---- listing / deletion (version snapshots) --------------------------------

export interface StoredItem {
  key: string;
  uploadedAt: number;
}

export async function listKeys(prefix: string): Promise<StoredItem[]> {
  const { bucket } = await resolveBucket();
  if (bucket) {
    const out: StoredItem[] = [];
    let cursor: string | undefined;
    do {
      const res = await bucket.list({ prefix, limit: 1000, cursor });
      for (const o of res.objects) {
        out.push({ key: o.key, uploadedAt: new Date(o.uploaded).getTime() });
      }
      cursor = res.truncated ? res.cursor : undefined;
    } while (cursor);
    return out;
  }
  const dir = path.join(DATA_DIR, prefix);
  try {
    const files = await fs.readdir(dir);
    const out: StoredItem[] = [];
    for (const f of files) {
      const st = await fs.stat(path.join(dir, f));
      out.push({ key: `${prefix}${f}`, uploadedAt: st.mtimeMs });
    }
    return out;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return [];
    throw err;
  }
}

export async function deleteKey(key: string): Promise<void> {
  const { bucket } = await resolveBucket();
  if (bucket) {
    await bucket.delete(key);
    return;
  }
  try {
    await fs.unlink(path.join(DATA_DIR, key));
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') throw err;
  }
}

// ---- binary uploads (images) ----------------------------------------------

// Uploads always resolve to a RELATIVE URL (/uploads/<name>) so stored content
// stays portable across hosts. In dev the file lands in public/uploads (served
// statically); in prod it lands in R2 and src/app/uploads/[file]/route.ts
// streams it back out.
export async function writeBinary(
  key: string,
  bytes: Buffer,
  contentType: string,
): Promise<string> {
  const name = path.basename(key);
  const { bucket, inWorkerRuntime } = await resolveBucket();
  if (bucket) {
    await bucket.put(`uploads/${name}`, bytes, { httpMetadata: { contentType } });
    return `/uploads/${name}`;
  }
  if (inWorkerRuntime) throw new StorageUnavailableError();
  await fs.mkdir(PUBLIC_UPLOADS, { recursive: true });
  await fs.writeFile(path.join(PUBLIC_UPLOADS, name), bytes);
  return `/uploads/${name}`;
}

/**
 * Read an uploaded image for serving. Null when it doesn't exist.
 *
 * `size` is returned so the route can send content-length. Without it the
 * response is chunked with no declared length: browsers cannot show real
 * download progress, and crawlers record the image as 0 bytes — which is why
 * an SEO audit reported only the 9 oversized /photos files and silently missed
 * the far heavier /uploads ones. `etag` lets conditional requests 304 instead
 * of re-sending megabytes.
 */
export async function readBinary(
  name: string,
): Promise<{
  body: ReadableStream | Uint8Array;
  contentType: string;
  size?: number;
  etag?: string;
} | null> {
  const { bucket } = await resolveBucket();
  if (bucket) {
    const obj = await bucket.get(`uploads/${name}`);
    if (obj == null) return null;
    return {
      body: obj.body,
      contentType: obj.httpMetadata?.contentType || 'application/octet-stream',
      size: obj.size,
      // `etag` is the unquoted form (see the interface note); an HTTP ETag
      // header must be quoted, so add the quotes here rather than model
      // httpEtag, whose weak W/ prefix R2 rejects on conditional writes.
      etag: `"${obj.etag}"`,
    };
  }
  try {
    const buf = await fs.readFile(path.join(PUBLIC_UPLOADS, name));
    const ext = path.extname(name).slice(1).toLowerCase();
    const types: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      avif: 'image/avif',
    };
    return {
      body: new Uint8Array(buf),
      contentType: types[ext] || 'application/octet-stream',
      size: buf.byteLength,
    };
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return null;
    throw err;
  }
}

// ---- typed documents (Nowhence contracts) ----------------------------------
// Every shared R2 document is read and written through these helpers so the
// zod schema is enforced on both sides of the wire.

/** Thrown when a stored (or about-to-be-stored) document fails its schema. */
export class DocValidationError extends Error {
  constructor(
    public readonly key: string,
    public readonly issues: unknown,
  ) {
    super(`Document "${key}" failed schema validation`);
    this.name = 'DocValidationError';
  }
}

/** Thrown when writeJsonCas exhausts its retries against concurrent writers. */
export class CasConflictError extends Error {
  constructor(
    public readonly key: string,
    public readonly attempts: number,
  ) {
    super(`Compare-and-swap on "${key}" lost the race ${attempts} times`);
    this.name = 'CasConflictError';
  }
}

/** Any zod schema whose OUTPUT is T (input may differ, e.g. defaults). */
export type DocSchema<T> = ZodType<T, ZodTypeDef, unknown>;

function parseDoc<T>(key: string, raw: string, schema: DocSchema<T>): T {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new DocValidationError(key, String(err));
  }
  const res = schema.safeParse(json);
  if (!res.success) throw new DocValidationError(key, res.error.issues);
  return res.data;
}

/** Read + validate a JSON document. Null when absent; throws
 *  DocValidationError when present but malformed. */
export async function readJson<T>(key: string, schema: DocSchema<T>): Promise<T | null> {
  const raw = await readText(key);
  if (raw == null) return null;
  return parseDoc(key, raw, schema);
}

/** Like readJson but also returns the version token (for optimistic UIs). */
export async function readJsonWithVersion<T>(
  key: string,
  schema: DocSchema<T>,
): Promise<{ data: T; version: DocVersion } | null> {
  const doc = await readDocWithVersion(key);
  if (doc == null) return null;
  return { data: parseDoc(key, doc.text, schema), version: doc.version };
}

export interface WriteJsonCasOptions<T> {
  /** Max attempts before CasConflictError (default 5). */
  retries?: number;
  /** Starting value when the document does not exist yet. Without it,
   *  `mutate` receives `null` for an absent document. */
  initial?: () => T;
}

/**
 * Read (with etag) → mutate → validate → conditional put, retried on a lost
 * race. `mutate` gets a freshly parsed copy on every attempt and may run up to
 * `retries` times, so it must be a pure function of its input. Throw inside it
 * to abort (the error propagates unchanged). Returns the document as written.
 */
export async function writeJsonCas<T>(
  key: string,
  schema: DocSchema<T>,
  mutate: (current: T | null) => T | Promise<T>,
  opts: WriteJsonCasOptions<T> = {},
): Promise<T> {
  const retries = opts.retries ?? 5;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const doc = await readDocWithVersion(key);
    const current: T | null = doc
      ? parseDoc(key, doc.text, schema)
      : opts.initial
        ? opts.initial()
        : null;
    const next = await mutate(current);
    const res = schema.safeParse(next);
    if (!res.success) throw new DocValidationError(key, res.error.issues);
    const text = JSON.stringify(res.data, null, 2);
    if (doc == null) {
      if (await createIfAbsent(key, text)) return res.data;
      continue;
    }
    if ((await writeDocIfMatch(key, text, doc.version)) !== null) return res.data;
  }
  throw new CasConflictError(key, retries);
}

/** Create-only write: a racing creator loses instead of clobbering.
 *  R2: `onlyIf.etagDoesNotMatch: '*'` (If-None-Match: *). Dev fs: flag `wx`. */
async function createIfAbsent(key: string, text: string): Promise<boolean> {
  const { bucket, inWorkerRuntime } = await resolveBucket();
  if (bucket) {
    const res = await bucket.put(key, text, {
      httpMetadata: { contentType: 'application/json; charset=utf-8' },
      customMetadata: { lineage: newLineage(), rev: '0' },
      onlyIf: { etagDoesNotMatch: '*' },
    });
    return res !== null;
  }
  if (inWorkerRuntime) throw new StorageUnavailableError();
  const full = path.join(DATA_DIR, key);
  return withKeyLock(key, async () => {
    await fs.mkdir(path.dirname(full), { recursive: true });
    try {
      await fs.writeFile(full, text, { encoding: 'utf8', flag: 'wx' });
      return true;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === 'EEXIST') return false;
      throw err;
    }
  });
}

/** Validate and create a brand-new object (e.g. `orders/{id}.json`).
 *  Returns false when the key already exists. */
export async function createJson<T>(key: string, schema: DocSchema<T>, data: T): Promise<boolean> {
  const res = schema.safeParse(data);
  if (!res.success) throw new DocValidationError(key, res.error.issues);
  return createIfAbsent(key, JSON.stringify(res.data, null, 2));
}

/** Snapshot a document into `versions/{doc}/{ts}.json` (immutable). Returns the key. */
export async function snapshotVersion(doc: string, data: unknown): Promise<string> {
  const key = `versions/${doc}/${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  await writeText(key, JSON.stringify(data, null, 2));
  return key;
}

// ---- media (`media/{id}/{w}.{fmt}`, immutable) ------------------------------

export type MediaFormat = 'avif' | 'webp' | 'jpg' | 'png';
export const MEDIA_CONTENT_TYPES: Record<MediaFormat, string> = {
  avif: 'image/avif',
  webp: 'image/webp',
  jpg: 'image/jpeg',
  png: 'image/png',
};

/** R2 key for one media variant. Width 0 = original upload. */
export function mediaKey(id: string, width: number, format: MediaFormat): string {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new Error('invalid media id');
  if (!Number.isInteger(width) || width < 0) throw new Error('invalid media width');
  return `media/${id}/${width}.${format}`;
}

/** Public URL for a media variant. Dev: served from public/media; prod: a
 *  `src/app/media/[...path]/route.ts` handler (WS-B) streams via readMedia. */
export function mediaUrl(id: string, width: number, format: MediaFormat): string {
  return `/${mediaKey(id, width, format)}`;
}

/** Store one immutable media variant. Returns its public URL. */
export async function putMedia(
  id: string,
  width: number,
  format: MediaFormat,
  bytes: Uint8Array,
): Promise<string> {
  const key = mediaKey(id, width, format);
  const { bucket, inWorkerRuntime } = await resolveBucket();
  if (bucket) {
    await bucket.put(key, bytes, { httpMetadata: { contentType: MEDIA_CONTENT_TYPES[format] } });
  } else {
    if (inWorkerRuntime) throw new StorageUnavailableError();
    const full = path.join(process.cwd(), 'public', key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, bytes);
  }
  return mediaUrl(id, width, format);
}

/** Read one media variant for serving. Null when absent. */
export async function readMedia(
  id: string,
  width: number,
  format: MediaFormat,
): Promise<{ body: ReadableStream | Uint8Array; contentType: string; size?: number; etag?: string } | null> {
  const key = mediaKey(id, width, format);
  const { bucket } = await resolveBucket();
  if (bucket) {
    const obj = await bucket.get(key);
    if (obj == null) return null;
    return {
      body: obj.body,
      contentType: MEDIA_CONTENT_TYPES[format],
      size: obj.size,
      etag: `"${obj.etag}"`,
    };
  }
  try {
    const buf = await fs.readFile(path.join(process.cwd(), 'public', key));
    return { body: new Uint8Array(buf), contentType: MEDIA_CONTENT_TYPES[format], size: buf.byteLength };
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return null;
    throw err;
  }
}
