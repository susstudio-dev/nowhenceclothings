import { promises as fs } from 'node:fs';
import path from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  CasConflictError,
  DocValidationError,
  createJson,
  mediaKey,
  putMedia,
  readDocWithVersion,
  readJson,
  readMedia,
  writeDocIfMatch,
  writeJsonCas,
} from './storage';

// Real filesystem backend (NODE_ENV !== 'production' under vitest → data/).
const DIR = '__test__/storage-cas';
const KEY = `${DIR}/cas.json`;
const DATA = path.join(process.env.NOWHENCE_DATA_DIR ?? path.join(process.cwd(), 'data'));

async function cleanup() {
  await fs.rm(path.join(DATA, DIR), { recursive: true, force: true });
  await fs.rm(path.join(DATA, '.meta', `${KEY.split('/').join('__')}.json`), { force: true });
  await fs.rm(path.join(process.env.NOWHENCE_DATA_DIR ?? path.join(process.cwd(), 'data'), 'media', 'test-img'), { recursive: true, force: true });
}
afterEach(cleanup);
afterAll(cleanup);

const Counter = z.object({ n: z.number().int() });

describe('readDocWithVersion / writeDocIfMatch (ported)', () => {
  it('refuses a second write based on the same stale version', async () => {
    await fs.mkdir(path.join(DATA, DIR), { recursive: true });
    await fs.writeFile(path.join(DATA, KEY), '{"n":1}', 'utf8');
    const base = (await readDocWithVersion(KEY))!.version;
    expect(await writeDocIfMatch(KEY, '{"n":2}', base)).not.toBeNull();
    expect(await writeDocIfMatch(KEY, '{"n":3}', base)).toBeNull();
  });
});

describe('readJson', () => {
  it('returns null when absent', async () => {
    expect(await readJson(KEY, Counter)).toBeNull();
  });
  it('throws DocValidationError on schema mismatch', async () => {
    await fs.mkdir(path.join(DATA, DIR), { recursive: true });
    await fs.writeFile(path.join(DATA, KEY), '{"n":"x"}', 'utf8');
    await expect(readJson(KEY, Counter)).rejects.toBeInstanceOf(DocValidationError);
  });
});

describe('writeJsonCas', () => {
  it('creates the document from `initial` when absent', async () => {
    const out = await writeJsonCas(KEY, Counter, (c) => ({ n: c!.n + 1 }), { initial: () => ({ n: 0 }) });
    expect(out).toEqual({ n: 1 });
    expect(await readJson(KEY, Counter)).toEqual({ n: 1 });
  });

  it('passes null to mutate when absent and no initial', async () => {
    const out = await writeJsonCas(KEY, Counter, (c) => ({ n: c ? c.n : 42 }));
    expect(out.n).toBe(42);
  });

  it('does not lose updates under concurrent writers', async () => {
    await writeJsonCas(KEY, Counter, () => ({ n: 0 }));
    await Promise.all(
      Array.from({ length: 5 }, () => writeJsonCas(KEY, Counter, (c) => ({ n: c!.n + 1 }), { retries: 10 })),
    );
    expect((await readJson(KEY, Counter))!.n).toBe(5);
  });

  it('retries when another writer wins, then succeeds', async () => {
    await writeJsonCas(KEY, Counter, () => ({ n: 0 }));
    let calls = 0;
    const out = await writeJsonCas(KEY, Counter, async (c) => {
      calls++;
      if (calls === 1) await writeJsonCas(KEY, Counter, () => ({ n: 100 })); // interloper
      return { n: c!.n + 1 };
    });
    expect(calls).toBe(2);
    expect(out.n).toBe(101);
  });

  it('throws CasConflictError when every attempt loses', async () => {
    await writeJsonCas(KEY, Counter, () => ({ n: 0 }));
    let i = 0;
    await expect(
      writeJsonCas(
        KEY,
        Counter,
        async (c) => {
          await writeJsonCas(KEY, Counter, () => ({ n: 1000 + i++ }));
          return { n: c!.n + 1 };
        },
        { retries: 3 },
      ),
    ).rejects.toBeInstanceOf(CasConflictError);
  });

  it('rejects an invalid next document without writing', async () => {
    await writeJsonCas(KEY, Counter, () => ({ n: 1 }));
    await expect(
      writeJsonCas(KEY, Counter, () => ({ n: 'bad' }) as unknown as { n: number }),
    ).rejects.toBeInstanceOf(DocValidationError);
    expect((await readJson(KEY, Counter))!.n).toBe(1);
  });

  it('propagates errors thrown by mutate (abort)', async () => {
    await expect(
      writeJsonCas(KEY, Counter, () => {
        throw new Error('nope');
      }),
    ).rejects.toThrow('nope');
  });
});

describe('createJson', () => {
  it('creates once and refuses to overwrite', async () => {
    expect(await createJson(`${DIR}/o.json`, Counter, { n: 1 })).toBe(true);
    expect(await createJson(`${DIR}/o.json`, Counter, { n: 2 })).toBe(false);
    expect(await readJson(`${DIR}/o.json`, Counter)).toEqual({ n: 1 });
  });
});

describe('media', () => {
  it('builds keys and rejects path traversal', () => {
    expect(mediaKey('abc_1', 640, 'avif')).toBe('media/abc_1/640.avif');
    expect(() => mediaKey('../x', 1, 'webp')).toThrow();
  });
  it('round-trips a variant on the dev backend', async () => {
    const url = await putMedia('test-img', 320, 'webp', new Uint8Array([1, 2, 3]));
    expect(url).toBe('/media/test-img/320.webp');
    const got = await readMedia('test-img', 320, 'webp');
    expect(got?.contentType).toBe('image/webp');
    expect(got?.size).toBe(3);
  });
});
