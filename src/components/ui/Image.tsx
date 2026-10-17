import type { MediaRef } from '@/lib/schemas/common';
import { cn } from './cn';

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

/** srcset for one format from MediaRef.widths (served at /media/{id}/{w}.{fmt}). */
export function mediaSrcSet(media: MediaRef, format: 'avif' | 'webp'): string | undefined {
  if (media.src || media.widths.length === 0) return undefined;
  return media.widths.map((w) => `/media/${media.id}/${w}.${format} ${w}w`).join(', ');
}

// STUB (Phase 0): <picture> with AVIF/WebP from R2 variants, final props.
export function Image({ media, sizes = '100vw', priority = false, className, alt }: ImageProps) {
  const largest = media.widths.length ? media.widths[media.widths.length - 1] : 0;
  const fallback = media.src ?? `/media/${media.id}/${largest}.webp`;
  const avif = mediaSrcSet(media, 'avif');
  const webp = mediaSrcSet(media, 'webp');
  return (
    <picture>
      {avif && <source type="image/avif" srcSet={avif} sizes={sizes} />}
      {webp && <source type="image/webp" srcSet={webp} sizes={sizes} />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
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
