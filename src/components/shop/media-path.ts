// Pure parser for /media/{id}/{width}.{fmt} (used by src/app/media/[...path]/route.ts).

const FORMATS = ['avif', 'webp', 'jpg', 'png'] as const;
export type ParsedMediaFormat = (typeof FORMATS)[number];

export function parseMediaPath(segments: string[]): { id: string; width: number; format: ParsedMediaFormat } | null {
  if (segments.length !== 2) return null;
  const [id, file] = segments;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  const m = /^(0|[1-9]\d{0,4})\.(avif|webp|jpg|png)$/.exec(file);
  if (!m) return null;
  return { id, width: Number(m[1]), format: m[2] as ParsedMediaFormat };
}
