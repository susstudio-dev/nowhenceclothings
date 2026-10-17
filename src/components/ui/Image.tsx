import type { MediaRef } from '@/lib/schemas/common';
import { cn } from './cn';
import { mediaFormats, mediaSrcSet } from './media-src';

export interface ImageProps {
  media: MediaRef;
  /** `sizes` attribute, e.g. "(min-width: 1024px) 50vw, 100vw". */
  sizes?: string;
  /** Above-the-fold (LCP) image: eager + high fetch priority. */
  priority?: boolean;
  className?: string;
  /** Overrides media.alt. */
  alt?: string;
}

export { mediaFormats, mediaSrcSet } from './media-src';

// STUB (Phase 0): <picture> with AVIF/WebP from R2 variants, final props.
export function Image({ media, sizes = '100vw', priority = false, className, alt }: ImageProps) {
  const largest = media.widths.length ? media.widths[media.widths.length - 1] : 0;
  const stored = mediaFormats(media);
  const fallbackFmt = (['webp', 'jpg', 'png', 'avif'] as const).find((f) => stored.includes(f)) ?? 'webp';
  const fallback = media.src ?? `/media/${media.id}/${largest}.${fallbackFmt}`;
  const avif = mediaSrcSet(media, 'avif');
  const webp = mediaSrcSet(media, 'webp');
  return (
    <picture>
      {avif && <source type="image/avif" srcSet={avif} sizes={sizes} />}
      {webp && <source type="image/webp" srcSet={webp} sizes={sizes} />}
      <img
        src={fallback}
        alt={alt ?? media.alt}
        width={media.width}
        height={media.height}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
        className={cn('block h-auto max-w-full bg-paper-deep object-cover', className)}
      />
    </picture>
  );
}
