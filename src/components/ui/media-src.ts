// Pure srcset helpers for <Image> (QA F5). Kept JSX-free so they unit-test.
import type { MediaRef } from '@/lib/schemas/common';

type MediaFormat = NonNullable<MediaRef['formats']>[number];

/** Formats stored for this image; absent field means WebP only (QA F5). */
export function mediaFormats(media: MediaRef): MediaFormat[] {
  return media.formats && media.formats.length ? media.formats : ['webp'];
}

/** Bundled brand defaults in public/: `/brand-default/{base}-{w}.webp` (A12). */
const BUNDLED = /^\/brand-default\/([a-z0-9-]+)-\d+\.(?:webp|avif)$/;

/**
 * srcset for one format from MediaRef.widths (served at /media/{id}/{w}.{fmt}).
 * Undefined when the format was not stored, so no broken candidates are listed.
 */
export function mediaSrcSet(media: MediaRef, format: 'avif' | 'webp'): string | undefined {
  const bundled = media.src ? BUNDLED.exec(media.src) : null;
  if (bundled && media.widths.length) {
    if (!mediaFormats(media).includes(format)) return undefined;
    return media.widths.map((w) => `/brand-default/${bundled[1]}-${w}.${format} ${w}w`).join(', ');
  }
  if (media.src || media.widths.length === 0) return undefined;
  if (!mediaFormats(media).includes(format)) return undefined;
  return media.widths.map((w) => `/media/${media.id}/${w}.${format} ${w}w`).join(', ');
}
