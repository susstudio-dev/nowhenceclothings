import { ImageResponse } from 'next/og';
import { getSettings } from '@/lib/content';
import { readMedia } from '@/lib/storage';
import { faviconAsset } from '@/lib/brand';

// Settings-driven favicon / app icon (A9b, fixes QA F10). Serves the owner's
// uploaded favicon (smallest stored WebP width >= 192), or a generated
// monogram in the brand colours when none is set yet.

export const dynamic = 'force-dynamic';

const CACHE = 'public, max-age=300, s-maxage=3600';

export async function GET(req: Request) {
  const s = await getSettings();
  const fav = s.brand.favicon;
  if (fav?.src) return Response.redirect(new URL(fav.src, 'https://nowhenceclothings.com'), 302);
  if (fav) {
    const obj = await readMedia(fav.id, faviconAsset(fav).mediaWidth!, 'webp');
    if (obj) {
      return new Response(obj.body as BodyInit, {
        headers: { 'content-type': obj.contentType, 'cache-control': CACHE, 'x-content-type-options': 'nosniff' },
      });
    }
  }
  // A12: no upload yet -> the owner's bundled symbol.
  if (!fav) return Response.redirect(new URL('/brand-default/icon-512.png', req.url), 302);
  const letter = (s.brand.wordmark || s.store.name || 'N').trim().charAt(0).toUpperCase() || 'N';
  const res = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: s.brand.colours.ink,
          color: s.brand.colours.paper,
          fontSize: 320,
          fontFamily: 'serif',
        }}
      >
        {letter}
      </div>
    ),
    { width: 512, height: 512 },
  );
  res.headers.set('cache-control', CACHE);
  return res;
}
