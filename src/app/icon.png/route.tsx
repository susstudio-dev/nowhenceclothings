import { ImageResponse } from 'next/og';
import { getSettings } from '@/lib/content';
import { readMedia } from '@/lib/storage';

// Settings-driven favicon / app icon (A9b, fixes QA F10). Serves the owner's
// uploaded favicon (smallest stored WebP width >= 192), or a generated
// monogram in the brand colours when none is set yet.

export const dynamic = 'force-dynamic';

const CACHE = 'public, max-age=300, s-maxage=3600';

export async function GET() {
  const s = await getSettings();
  const fav = s.brand.favicon;
  if (fav?.src) return Response.redirect(new URL(fav.src, 'https://nowhenceclothings.com'), 302);
  if (fav) {
    const widths = fav.widths.length ? fav.widths : [fav.width];
    const w = widths.find((x) => x >= 192) ?? widths[widths.length - 1];
    const obj = await readMedia(fav.id, w, 'webp');
    if (obj) {
      return new Response(obj.body as BodyInit, {
        headers: { 'content-type': obj.contentType, 'cache-control': CACHE, 'x-content-type-options': 'nosniff' },
      });
    }
  }
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
