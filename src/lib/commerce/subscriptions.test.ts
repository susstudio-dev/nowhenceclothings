import { promises as fs } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readJson } from '@/lib/storage';
import { NewsletterDoc, NotifyDoc } from '@/lib/schemas/logs';
import { subscribeNewsletter, subscribeNotify } from './subscriptions';

const NOTIFY = '__test__/notify-sub.json';
const NEWS = '__test__/newsletter-sub.json';

afterAll(async () => {
  const data = path.join(process.cwd(), 'data');
  for (const k of [NOTIFY, NEWS]) {
    await fs.rm(path.join(data, k), { force: true });
    await fs.rm(path.join(data, '.meta', `${k.replace(/\//g, '__')}.json`), { force: true });
  }
});

describe('subscriptions', () => {
  it('dedupes notify signups case-insensitively', async () => {
    expect(await subscribeNotify('SKU-1', 'A@B.co', 'restock', NOTIFY)).toBe(true);
    expect(await subscribeNotify('SKU-1', 'a@b.co', 'restock', NOTIFY)).toBe(false);
    expect((await readJson(NOTIFY, NotifyDoc))!.subscribers).toHaveLength(1);
  });
  it('dedupes newsletter signups under concurrency', async () => {
    const res = await Promise.all([1, 2, 3].map(() => subscribeNewsletter('x@y.co', 'footer', NEWS)));
    expect(res.filter(Boolean)).toHaveLength(1);
    expect((await readJson(NEWS, NewsletterDoc))!.signups).toHaveLength(1);
  });
});
