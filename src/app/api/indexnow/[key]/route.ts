import { currentIndexNowKey } from '@/lib/indexnow-server';

export const dynamic = 'force-dynamic';

// IndexNow key file. next.config.mjs rewrites /{key}.txt here. It answers only
// for the configured key (INDEXNOW_KEY env, else Settings -> Marketing) and
// returns the key itself as plain text, which is how search engines verify
// that we own the host.
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const configured = await currentIndexNowKey();
  if (!configured || key !== configured) return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  return new Response(configured, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=300' },
  });
}
