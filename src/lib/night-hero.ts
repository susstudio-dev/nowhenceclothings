// Home hero "eyes in the dark" (docs/superpowers/specs/2026-10-19-night-hero-design.md).
// Pure: which motifs have prepared photographs, the timeline, the shader's cover fit, the idle torch path and the
// order-map decoding (in step with scripts/prep-night-hero.mjs). The client stage only applies these.
import type { Motif } from './stitch-hero';

export type Crop = 'wide' | 'tall';

export interface NightCrop {
  full: string;
  bare: string;
  order: string;
  /** Pixel size, for the cover fit. */
  w: number;
  h: number;
}

export interface NightHeroEntry {
  /** The h1, two sentences. */
  lines: readonly [string, string];
  /** `wide` at 768px and up, `tall` (4:5) below. */
  crops: Readonly<Record<Crop, NightCrop>>;
  /** The pair of eyes on the stage, as fractions of its box (left, top, width), per crop. */
  eyes: Readonly<Record<Crop, { x: number; y: number; w: number }>>;
  /** A photograph of the eyes on black (screen-blended); without one the drawn eyes are used. */
  eyesImage?: string;
}

const crop = (motif: Motif, c: Crop, w: number, h: number): NightCrop => ({
  full: `/hero/${motif}/${c}/full.webp`,
  bare: `/hero/${motif}/${c}/bare.webp`,
  order: `/hero/${motif}/${c}/order.png`,
  w,
  h,
});

const NIGHT: Partial<Record<Motif, NightHeroEntry>> = {
  // A black panther is a leopard: its rosettes are there, seen only in the right light. So is the polo's embroidery.
  rings: {
    lines: ['Every black panther has spots.', 'You only see them in the light.'],
    crops: { wide: crop('rings', 'wide', 1600, 900), tall: crop('rings', 'tall', 1280, 1600) },
    eyes: { wide: { x: 0.63, y: 0.3, w: 0.2 }, tall: { x: 0.42, y: 0.2, w: 0.46 } },
  },
};

/** The night hero for a motif, when its photographs have been prepared. */
export function nightHeroFor(motif: Motif | undefined): NightHeroEntry | undefined {
  return motif ? NIGHT[motif] : undefined;
}

/** UV scale that makes the image cover the stage from its centre (multiplied around 0.5 in the shader). */
export function coverScale(stageAspect: number, imageAspect: number): [number, number] {
  return stageAspect > imageAspect ? [1, imageAspect / stageAspect] : [stageAspect / imageAspect, 1];
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** A stitch time as the order map's two bytes (R high, G low). */
export function encodeOrder(t: number): [number, number] {
  const q = Math.round(clamp01(t) * 65535);
  return [q >> 8, q & 255];
}

/** The order map's two bytes back to a stitch time; the shader does the same on 0–1 channel values. */
export function decodeOrder(r: number, g: number): number {
  return (r * 256 + g) / 65535;
}

/** Where the torch wanders when the pointer is idle, as fractions of the stage (y down). */
export function driftAt(seconds: number): [number, number] {
  return [0.56 + 0.26 * Math.sin(seconds * 0.42), 0.46 + 0.2 * Math.sin(seconds * 0.67 + 1.2)];
}

export type Beat = 'eyesIn' | 'lidsOpen' | 'torchOn' | 'stitch' | 'blink' | 'eyesOut' | 'lightUp';

export const NIGHT_MS = { wide: 11000, compact: 8000 } as const;

/** Desktop beats, [start, duration] in ms: dark, light, stitch, reveal. */
const WIDE: Record<Beat, readonly [number, number]> = {
  eyesIn: [200, 900],
  lidsOpen: [300, 700],
  torchOn: [1400, 1400],
  stitch: [3000, 6600],
  blink: [9400, 1100],
  eyesOut: [10100, 900],
  lightUp: [9400, 1600],
};

/** The beats for a width; phones run the same sequence scaled to 8 s. */
export function timelineFor(compact: boolean): Record<Beat, { at: number; dur: number }> {
  const k = compact ? NIGHT_MS.compact / NIGHT_MS.wide : 1;
  return Object.fromEntries(
    Object.entries(WIDE).map(([b, [at, dur]]) => [b, { at: Math.round(at * k), dur: Math.round(dur * k) }]),
  ) as Record<Beat, { at: number; dur: number }>;
}

/** Shader values before the sequence and after it. */
export const NIGHT_DARK = { prog: 0, amb: 0.04, torch: 0, rad: 0.08 } as const;
export const NIGHT_LIT = { prog: 1, amb: 0.62, torch: 1, rad: 0.3 } as const;
/** The torch's radius while the rosettes are stitched. */
export const TORCH_RAD = 0.17;
