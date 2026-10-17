import { readMedia, MEDIA_CONTENT_TYPES, type MediaFormat } from '@/lib/storage';
import { parseMediaPath } from '@/components/shop/media-path';

// Serves immutable image variants: /media/{id}/{width}.{avif|webp|jpg|png}
// (R2 in production, public/media under next dev).

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parsed = parseMediaPath((await params).path);
  if (!parsed) return new Response('Not found', { status: 404 });
  const obj = await readMedia(parsed.id, parsed.width, parsed.format as MediaFormat);
  if (!obj) return new Response('Not found', { status: 404 });

  if (obj.etag && req.headers.get('if-none-match') === obj.etag) {
    return new Response(null, { status: 304, headers: { etag: obj.etag } });
  }
  const headers = new Headers({
    'content-type': MEDIA_CONTENT_TYPES[parsed.format as MediaFormat],
    'cache-control': 'public, max-age=31536000, immutable',
    'x-content-type-options': 'nosniff',
  });
  if (obj.etag) headers.set('etag', obj.etag);
  if (obj.size != null) headers.set('content-length', String(obj.size));
  return new Response(obj.body as BodyInit, { headers });
}
