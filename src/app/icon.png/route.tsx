import { getSettings } from '@/lib/content';
import { readMedia } from '@/lib/storage';
import { faviconAsset } from '@/lib/brand';
import { BUNDLED_ICONS, usableFavicon } from '@/lib/icons';

// Settings-driven favicon / app icon (A9b, fixes QA F10). Serves the owner's
// uploaded favicon (smallest stored WebP width >= 192) when it is big enough
// to use (>= 48 px), otherwise the bundled Nowhence symbol (A12). Never a
// monogram or the full wordmark.

export const dynamic = 'force-dynamic';

const CACHE = 'public, max-age=300, s-maxage=3600';

export async function GET(req: Request) {
  const s = await getSettings();
  const fav = usableFavicon(s.brand.favicon);
  if (fav?.src) return Response.redirect(new URL(fav.src, 'https://nowhenceclothings.com'), 302);
  if (fav) {
    const obj = await readMedia(fav.id, faviconAsset(fav).mediaWidth!, 'webp');
    if (obj) {
      return new Response(obj.body as BodyInit, {
        headers: { 'content-type': obj.contentType, 'cache-control': CACHE, 'x-content-type-options': 'nosniff' },
      });
    }
  }
  return Response.redirect(new URL(BUNDLED_ICONS.png512, req.url), 302);
}
