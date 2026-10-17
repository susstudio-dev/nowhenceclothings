// Pure media helpers (A2). Width variants are generated in the BROWSER (a
// Worker has milliseconds of CPU; furor pattern). The upload route only
// sniffs, bounds-checks and stores them under media/{id}/{w}.{fmt}.
import type { MediaFormat } from '@/lib/storage';

/** Widths the uploader produces (ascending). */
export const MEDIA_WIDTHS = [480, 800, 1200, 1600] as const;
/** Per-file byte cap. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
/** Max variant files in one upload. */
export const MAX_VARIANT_FILES = 12;

/** Detect the real format from magic bytes; never trust the client's MIME. */
export function sniffImage(b: Uint8Array): MediaFormat | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  const ascii = (i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));
  if (b.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'webp';
  if (b.length >= 12 && ascii(4, 4) === 'ftyp' && /^avi[fs]$/.test(ascii(8, 4))) return 'avif';
  return null;
}

/** Widths to generate for an image `naturalWidth` wide (never upscale). */
export function targetWidths(naturalWidth: number, widths: readonly number[] = MEDIA_WIDTHS): number[] {
  const fit = widths.filter((w) => w <= naturalWidth);
  return fit.length ? fit : [Math.max(1, Math.round(naturalWidth))];
}

/** URL-safe media id: slugged file name + random suffix. */
export function newMediaId(filename = 'img'): string {
  const base =
    filename
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'img';
  const rnd = Array.from(crypto.getRandomValues(new Uint8Array(4)), (x) => x.toString(16).padStart(2, '0')).join('');
  return `${base}-${rnd}`;
}

/** Form field name `w800.avif` -> { width: 800, format: 'avif' }. */
export function parseVariantField(name: string): { width: number; format: MediaFormat } | null {
  const m = /^w(\d{2,4})\.(avif|webp|jpg|png)$/.exec(name);
  if (!m) return null;
  return { width: Number(m[1]), format: m[2] as MediaFormat };
}
