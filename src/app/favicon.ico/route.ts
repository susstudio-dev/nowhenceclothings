import { getSettings } from '@/lib/content';
import { FAVICON_ICO_BASE64 } from '@/lib/brand-icon-data';
import { usableFavicon } from '@/lib/icons';

export const dynamic = 'force-dynamic';

const CACHE = 'public, max-age=300, s-maxage=3600';

function icoBytes(): Uint8Array {
  const bin = atob(FAVICON_ICO_BASE64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// /favicon.ico: browsers and crawlers still ask for it by default. Serves the
// bundled multi-size symbol icon (16/32/48) directly, with no redirect. When
// the owner has uploaded a favicon (Settings -> Brand) it hands over to
// /icon.png instead, so the upload overrides here too.
export async function GET(req: Request) {
  const settings = await getSettings().catch(() => null);
  if (usableFavicon(settings?.brand.favicon)) return Response.redirect(new URL('/icon.png', req.url), 302);
  return new Response(icoBytes() as BodyInit, {
    headers: { 'content-type': 'image/x-icon', 'cache-control': CACHE, 'x-content-type-options': 'nosniff' },
  });
}
