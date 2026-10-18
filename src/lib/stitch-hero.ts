// Home hero "the stitch": a drawn polo that makes itself (docs/superpowers/specs/2026-10-18-stitch-hero-design.md).
// Pure: motif choice, palette, geometry, timeline, camera and SVG markup. The client stage only writes the
// per-frame values `frame()` returns. Coordinates are the garment's own space, a 600 × 700 flat lay.

export type Motif = 'rings' | 'wing' | 'rain' | 'pebbles' | 'diamonds';
export type Pt = [number, number];

/* ---------- which polo, which motif ---------- */

const MOTIF_WORDS: [RegExp, Motif][] = [
  // The black polo's rings are panther rosettes; the catalogue may name it either way.
  [/(^|[^a-z])(rings?|panthers?|leopards?|rosettes?)([^a-z]|$)/, 'rings'],
  // Each motif is an animal's pattern: kestrel feathers, whale-shark spots, crocodile scutes, rattlesnake diamonds.
  [/(^|[^a-z])(wings?|kestrels?|feathers?)([^a-z]|$)/, 'wing'],
  [/(^|[^a-z])(rain|whale[\s-]?sharks?)([^a-z]|$)/, 'rain'],
  [/(^|[^a-z])(pebbles?|crocodiles?|crocs?)([^a-z]|$)/, 'pebbles'],
  [/(^|[^a-z])(diamonds?|diamondbacks?|rattlesnakes?)([^a-z]|$)/, 'diamonds'],
];

const matchMotif = (text: string) => MOTIF_WORDS.find(([re]) => re.test(text.toLowerCase()))?.[1];

/**
 * The embroidery a product carries, read from the words in its slug or title, or failing that from its
 * photographs' alt text (a renamed product keeps describing its embroidery there).
 */
export function motifFor(p: { slug: string; title: string; colours?: readonly { images?: readonly { alt?: string }[] }[] }): Motif | undefined {
  const alts = (p.colours ?? []).flatMap((c) => c.images ?? []).map((i) => i.alt ?? '');
  return matchMotif(`${p.slug} ${p.title}`) ?? matchMotif(alts.join(' '));
}

/**
 * The product the stitch hero draws. An open pre-order piece always leads the home page: it gets the stitch
 * hero only if it has a motif (otherwise the photo hero keeps the slot). With no pre-order, the first product
 * with a motif leads.
 */
export function pickStitchProduct<T extends { slug: string; title: string }>(featured: T | undefined, products: readonly T[]): T | undefined {
  if (featured) return motifFor(featured) ? featured : undefined;
  return products.find((p) => motifFor(p));
}

/* ---------- colour ---------- */

/** The cloth's own tones. The backdrop and chalk come from the brand theme (StitchHero), not from here. */
export interface StitchPalette {
  cloth: string;
  hi: string;
  lo: string;
  thread: string;
  threadHi: string;
  /** The thread's side away from the light. */
  threadLo: string;
  shadow: string;
  seam: string;
}

function rgb(hex: string): number[] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(c: number[], to: number, k: number): string {
  return '#' + c.map((v) => Math.round(v + (to - v) * k).toString(16).padStart(2, '0')).join('').toUpperCase();
}
function luminance(c: number[]): number {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/**
 * Tonal thread and shading from the cloth colour: embroidery sits a shade off the cloth, never a contrast
 * colour. On dark cloth the thread is the charcoal of the photographs, catching the light on its top edge.
 */
export function stitchPalette(hex: string): StitchPalette {
  const c = rgb(/^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#141412');
  const cloth = mix(c, 0, 0);
  if (luminance(c) > 0.4) {
    return { cloth, hi: mix(c, 255, 0.45), lo: mix(c, 0, 0.1), thread: mix(c, 0, 0.12), threadHi: mix(c, 255, 0.55), threadLo: mix(c, 0, 0.26), shadow: mix(c, 0, 0.3), seam: mix(c, 0, 0.14) };
  }
  return { cloth, hi: mix(c, 255, 0.07), lo: mix(c, 0, 0.4), thread: mix(c, 255, 0.17), threadHi: mix(c, 255, 0.42), threadLo: mix(c, 255, 0.05), shadow: mix(c, 0, 0.7), seam: mix(c, 255, 0.09) };
}

/* ---------- geometry ---------- */

const clamp = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const eo = (x: number) => 1 - Math.pow(1 - x, 4);
const eio = (x: number) => (x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Deterministic, so the same polo always stitches the same way. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Points along an absolute M/L/C/Z path (the only commands the garment uses). */
export function sampleD(d: string): Pt[] {
  const tk = d.match(/[MLCZ]|-?\d*\.?\d+/g) ?? [];
  const pts: Pt[] = [];
  let i = 0;
  let cmd = 'M';
  let cur: Pt = [0, 0];
  let start: Pt = [0, 0];
  const num = (j: number) => Number(tk[j]);
  while (i < tk.length) {
    if (/[MLCZ]/.test(tk[i]!)) {
      cmd = tk[i++]!;
      if (cmd === 'Z') {
        pts.push([start[0], start[1]]);
        continue;
      }
    }
    if (cmd === 'M' || cmd === 'L') {
      cur = [num(i), num(i + 1)];
      i += 2;
      if (cmd === 'M') {
        start = [cur[0], cur[1]];
        cmd = 'L';
      }
      pts.push([cur[0], cur[1]]);
    } else if (cmd === 'C') {
      const a = cur;
      const b: Pt = [num(i), num(i + 1)];
      const c: Pt = [num(i + 2), num(i + 3)];
      const p: Pt = [num(i + 4), num(i + 5)];
      i += 6;
      for (let k = 1; k <= 24; k++) {
        const u = k / 24;
        const m = 1 - u;
        pts.push([
          m * m * m * a[0] + 3 * m * m * u * b[0] + 3 * m * u * u * c[0] + u * u * u * p[0],
          m * m * m * a[1] + 3 * m * m * u * b[1] + 3 * m * u * u * c[1] + u * u * u * p[1],
        ]);
      }
      cur = p;
    } else i++;
  }
  return pts;
}

/** Evenly spaced points every `ds` units along a polyline (ends kept). */
export function resample(pts: Pt[], ds: number): Pt[] {
  const out: Pt[] = [[pts[0]![0], pts[0]![1]]];
  let need = ds;
  for (let i = 1; i < pts.length; i++) {
    let ax = pts[i - 1]![0];
    let ay = pts[i - 1]![1];
    const [bx, by] = pts[i]!;
    let L = Math.hypot(bx - ax, by - ay);
    while (L >= need) {
      const k = need / L;
      ax += (bx - ax) * k;
      ay += (by - ay) * k;
      out.push([ax, ay]);
      L -= need;
      need = ds;
    }
    need -= L;
  }
  const last = pts[pts.length - 1]!;
  out.push([last[0], last[1]]);
  return out;
}

/** Cumulative length at each point. */
export function cumul(pts: Pt[]): number[] {
  const c = [0];
  for (let i = 1; i < pts.length; i++) c.push(c[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
  return c;
}

/** The point a fraction `p` of the way along, and the index of the segment it falls in. */
export function pointAt(pts: Pt[], cum: number[], p: number): { x: number; y: number; i: number } {
  const L = p * cum[cum.length - 1]!;
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (cum[m]! <= L) lo = m;
    else hi = m;
  }
  const span = cum[hi]! - cum[lo]! || 1;
  const k = (L - cum[lo]!) / span;
  return { x: lerp(pts[lo]![0], pts[hi]![0], k), y: lerp(pts[lo]![1], pts[hi]![1], k), i: lo };
}

/** Satin stitch: the thread crosses the line from side to side, `w` wide, every 0.4 units, packed like real satin. */
export function zigzag(pts: Pt[], w: number): Pt[] {
  const r = resample(pts, 0.4);
  return r.map((p, i) => {
    const a = r[Math.max(0, i - 1)]!;
    const b = r[Math.min(r.length - 1, i + 1)]!;
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    const s = ((i % 2 ? 1 : -1) * w) / 2;
    return [p[0] - ty * s, p[1] + tx * s] as Pt;
  });
}

const toD = (pts: Pt[]) => 'M' + pts.map((p) => `${r1(p[0])} ${r1(p[1])}`).join('L');
/** Mirror a path of absolute coordinate pairs across the garment's centre line. */
export const mirrorD = (d: string) => d.replace(/(-?\d*\.?\d+)\s+(-?\d*\.?\d+)/g, (_m, x: string, y: string) => `${600 - Number(x)} ${y}`);

function inPoly(p: Pt, poly: Pt[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** A hand-drawn loop: an ellipse with a little wobble, open when `sweep` < 2π. */
function blob(cx: number, cy: number, rx: number, ry: number, R: () => number, sweep = Math.PI * 2, a0 = 0): Pt[] {
  const n = Math.max(24, Math.round(Math.max(rx, ry) * 6));
  const w1 = R() * 6.28;
  const w2 = R() * 6.28;
  const pts: Pt[] = [];
  for (let k = 0; k <= n; k++) {
    const th = a0 + (sweep * k) / n;
    const f = 1 + 0.12 * Math.sin(3 * th + w1) + 0.06 * Math.sin(5 * th + w2);
    pts.push([cx + rx * f * Math.cos(th), cy + ry * f * Math.sin(th)]);
  }
  return pts;
}

/* ---------- the garment ---------- */

export const VIEW = { w: 600, h: 700 };
export const BODY = 'M238 96 C262 122 338 122 362 96 L446 124 C432 170 436 220 452 262 L456 640 L144 640 L148 262 C164 220 168 170 154 124 Z';
const SLEEVE = 'M154 124 C168 170 164 220 148 262 L112 296 L52 238 C78 186 110 146 154 124 Z';
const CUFF = 'M52 238 L112 296 L98 310 L38 252 Z';
const COLLAR = 'M236 96 C258 76 342 76 364 96 L372 106 L348 152 C334 138 316 128 302 124 L298 124 C284 128 266 138 252 152 L228 106 Z';
const PLACKET = 'M286 122 L314 122 L314 226 L286 226 Z';
const MIRROR = 'matrix(-1 0 0 1 600 0)';

export type PieceId = 'body' | 'placket' | 'sleeveL' | 'sleeveR' | 'cuffL' | 'cuffR' | 'collar';
export interface Piece {
  id: PieceId;
  d: string;
  mirror?: boolean;
  tex: 'pique' | 'ribV' | 'ribC';
  /** Rotation centre. */
  c: Pt;
  /** Where the cut piece starts, lifted off the table: dx, dy, degrees, scale (above 1 = held up). */
  from: [number, number, number, number];
  /** Arrival order. */
  k: number;
  folds?: 'body' | 'sleeve';
}
// Each piece is carried in a short way from beside its place, held a little above the table, and laid down
// square: a small turn, no spins. The lift shows in its scale and in a longer, softer shadow.
export const PIECES: Piece[] = [
  { id: 'body', d: BODY, tex: 'pique', c: [300, 380], from: [0, 40, 0, 1.03], k: 0, folds: 'body' },
  { id: 'placket', d: PLACKET, tex: 'pique', c: [300, 174], from: [0, 70, 0, 1.06], k: 1 },
  { id: 'sleeveL', d: SLEEVE, tex: 'pique', c: [110, 215], from: [-96, -18, -6, 1.04], k: 2, folds: 'sleeve' },
  { id: 'sleeveR', d: SLEEVE, mirror: true, tex: 'pique', c: [490, 215], from: [96, -18, 6, 1.04], k: 2, folds: 'sleeve' },
  { id: 'cuffL', d: CUFF, tex: 'ribC', c: [75, 274], from: [-54, 46, -9, 1.06], k: 3 },
  { id: 'cuffR', d: CUFF, mirror: true, tex: 'ribC', c: [525, 274], from: [54, 46, 9, 1.06], k: 3 },
  { id: 'collar', d: COLLAR, tex: 'ribV', c: [300, 112], from: [0, -74, 0, 1.06], k: 4 },
];

/** Which piece each motif is stitched on. The wing sits on the wearer's left sleeve, as on the photograph. */
export const MOTIF_HOST: Record<Motif, PieceId> = { rings: 'body', wing: 'sleeveR', rain: 'body', pebbles: 'body', diamonds: 'body' };

const L_SEAMS = ['M238 98 L156 126', 'M157 127 C171 172 167 221 151 262', 'M150 265 L114 294', 'M150 268 L146 636', 'M55 241 L111 293', 'M233 107 L253 146'];
/** Seams in sewing order; a pair is sewn left and right at once. */
const SEAM_GROUPS: string[][] = [
  [L_SEAMS[0]!, mirrorD(L_SEAMS[0]!)],
  [L_SEAMS[1]!, mirrorD(L_SEAMS[1]!)],
  [L_SEAMS[2]!, mirrorD(L_SEAMS[2]!)],
  [L_SEAMS[3]!, mirrorD(L_SEAMS[3]!)],
  [L_SEAMS[4]!, mirrorD(L_SEAMS[4]!)],
  ['M146 628 L454 628'],
  ['M289 124 L289 223 L311 223 L311 124'],
  [L_SEAMS[5]!, mirrorD(L_SEAMS[5]!)],
  ['M240 99 C262 85 338 85 360 99'],
];
const BUTTONS: Pt[] = [
  [300, 146],
  [300, 190],
];

/* ---------- motifs ---------- */

type Raw = { kind: 'satin'; pts: Pt[]; w: number } | { kind: 'dot'; cx: number; cy: number; r: number };
const satin = (pts: Pt[], w: number): Raw => ({ kind: 'satin', pts, w });

export const MOTIFS: Record<Motif, () => Raw[]> = {
  /** Loose rings scattered from the shoulder down across the chest. */
  rings() {
    const R = rng(11);
    const A: Pt = [196, 146];
    const B: Pt = [330, 500];
    const dx = B[0] - A[0];
    const dy = B[1] - A[1];
    const L = Math.hypot(dx, dy);
    const px = dy / L;
    const py = -dx / L;
    const cand: { cx: number; cy: number; r: number; u: number; open: boolean; a0: number }[] = [];
    for (let tries = 0; cand.length < 36 && tries < 6000; tries++) {
      const u = R();
      const sp = (1 - u * 0.5) * 64 * (R() * 2 - 1);
      const cx = A[0] + dx * u + px * sp;
      const cy = A[1] + dy * u + py * sp;
      const r = 4.5 + R() * R() * 9 + (1 - u) * 2.5;
      if (cx - r < 172 || cx + r > 440 || cy - r < 130 || cy + r > 610) continue;
      if (Math.abs(cx - 300) < 22 + r && cy < 232 + r) continue;
      if (Math.abs(cx - 300) < 84 && cy < 160 + r) continue;
      if (cand.some((o) => Math.hypot(o.cx - cx, o.cy - cy) < o.r + r + 4)) continue;
      cand.push({ cx, cy, r, u, open: R() < 0.38, a0: R() * 6.28 });
    }
    cand.sort((a, b) => a.u - b.u);
    return cand.map((o) => satin(blob(o.cx, o.cy, o.r, o.r * 0.94, R, o.open ? 3.9 + R() * 1.4 : Math.PI * 2, o.a0), o.r > 8 ? 2.3 : 1.8));
  },
  /** Feather scales down the sleeve, growing toward the cuff, each with a small vein. */
  wing() {
    const poly: Pt[] = [[446, 124], [441, 170], [443, 220], [452, 262], [488, 296], [548, 238], [522, 190], [490, 150]];
    const O: Pt = [452, 128];
    const u: Pt = [0.461, 0.888];
    const v: Pt = [0.888, -0.461];
    const out: (Raw & { o: number })[] = [];
    let s = 8;
    let row = 0;
    while (s < 170) {
      const r = 5 + Math.min(1, s / 150) * 5.5;
      for (let j = -9; j <= 9; j++) {
        const w = j * r * 2.05 + (row % 2 ? r * 1.02 : 0);
        const c: Pt = [O[0] + u[0] * s + v[0] * w, O[1] + u[1] * s + v[1] * w];
        const probe: Pt[] = [
          [c[0] + v[0] * r, c[1] + v[1] * r],
          [c[0] - v[0] * r, c[1] - v[1] * r],
          [c[0] + u[0] * r * 1.4, c[1] + u[1] * r * 1.4],
          [c[0] - u[0] * 2, c[1] - u[1] * 2],
        ];
        if (!probe.every((p) => inPoly(p, poly))) continue;
        const pts: Pt[] = [];
        for (let k = 0; k <= 26; k++) {
          const th = (Math.PI * k) / 26;
          pts.push([c[0] + v[0] * r * Math.cos(th) + u[0] * r * 1.25 * Math.sin(th), c[1] + v[1] * r * Math.cos(th) + u[1] * r * 1.25 * Math.sin(th)]);
        }
        out.push({ ...satin(pts, 1.7), o: s * 100 + w });
        const a: Pt = [c[0] + u[0] * r * 0.2, c[1] + u[1] * r * 0.2];
        const b: Pt = [c[0] + u[0] * r, c[1] + u[1] * r];
        const k1: Pt = [b[0] - u[0] * r * 0.35 + v[0] * r * 0.25, b[1] - u[1] * r * 0.35 + v[1] * r * 0.25];
        const k2: Pt = [b[0] - u[0] * r * 0.35 - v[0] * r * 0.25, b[1] - u[1] * r * 0.35 - v[1] * r * 0.25];
        out.push({ ...satin([a, b, k1, b, k2], 0.9), o: s * 100 + w + 0.5 });
      }
      s += r * 1.45;
      row++;
    }
    return out.sort((a, b) => a.o - b.o).map(({ o: _o, ...raw }) => raw as Raw);
  },
  /** Wavy rain lines at the right hip, breaking into drops that scatter toward the centre. */
  rain() {
    const R = rng(5);
    const out: Raw[] = [];
    const dots: { cx: number; cy: number; r: number }[] = [];
    const xAt = (k: number, y: number) => 444 - k * 8 + 1.7 * Math.sin(y / 8.5 + k * 1.3);
    for (let k = 0; k < 10; k++) {
      const y0 = 392 + R() * 26 + k * 1.5;
      const y1 = 598 - R() * 24;
      const pts: Pt[] = [];
      for (let y = y0; y <= y1; y += 2) pts.push([xAt(k, y), y]);
      out.push(satin(pts, 1.5));
    }
    for (let i = 0; i < 70; i++) {
      const k = Math.floor(R() * 10);
      const y = 400 + R() * 190;
      dots.push({ cx: xAt(k, y) + (R() < 0.5 ? 0 : 3.4 * (R() < 0.5 ? -1 : 1)), cy: y, r: 1 + R() * 1.9 });
    }
    for (let i = 0; i < 170; i++) {
      const f = Math.pow(R(), 1.7);
      const cx = 368 - f * 190;
      const sp = (1 - f * 0.55) * 95;
      const cy = 492 + (R() * 2 - 1) * sp * 0.9;
      const r = (2 - f * 1.2) * (0.6 + R() * 0.6);
      if (cx < 176 || cy > 615) continue;
      dots.push({ cx, cy, r });
    }
    const kept: typeof dots = [];
    for (const d of dots) if (!kept.some((o) => Math.hypot(o.cx - d.cx, o.cy - d.cy) < o.r + d.r + 0.6)) kept.push(d);
    kept.sort((a, b) => b.cx - a.cx);
    return out.concat(kept.map((d) => ({ kind: 'dot' as const, ...d })));
  },
  /** A brick band at the hem, a mound of pebbles on it, cones rising from the mound and a few drops above. */
  pebbles() {
    const R = rng(9);
    const out: Raw[] = [];
    const top = (x: number) => 600 - 34 * Math.exp(-Math.pow((x - 300) / 120, 2)) - 6;
    out.push(satin([[150, 620], [450, 620]], 1.4), satin([[150, 612], [450, 612]], 1.4));
    for (let x = 152, i = 0; x < 448; x += 13, i++) out.push(satin([[x + (i % 2) * 6, 613.5], [x + (i % 2) * 6, 618.5]], 1));
    const peb: { x: number; y: number; r: number }[] = [];
    for (let tries = 0; peb.length < 95 && tries < 9000; tries++) {
      const x = 154 + R() * 292;
      const tp = top(x);
      const y = lerp(tp, 606, Math.pow(R(), 0.7));
      const r = 2.4 + ((y - tp) / (606 - tp + 1)) * 3.6 * (0.6 + R() * 0.5);
      if (y + r > 609 || x - r < 150 || x + r > 450) continue;
      if (peb.some((o) => Math.hypot(o.x - x, o.y - y) < o.r + r + 1.2)) continue;
      peb.push({ x, y, r });
    }
    peb.sort((a, b) => a.x - b.x);
    for (const p of peb) out.push(satin(blob(p.x, p.y, p.r * 1.15, p.r * 0.85, R), 1.3));
    for (let i = 0; i < 26; i++) {
      const x = 162 + R() * 276;
      const b = top(x) + 3;
      const h = 7 + R() * 14 * (1 - Math.abs(x - 300) / 220);
      const w = 3 + R() * 2.5;
      out.push(satin([[x - w, b], [x, b - h], [x + w, b], [x - w, b]], 1.1));
    }
    for (let i = 0; i < 14; i++) {
      const x = 180 + R() * 240;
      out.push({ kind: 'dot', cx: x, cy: top(x) - 12 - R() * 16, r: 1.4 + R() * 1.4 });
    }
    return out;
  },
  /** A chevron of diamonds from shoulder to shoulder, each ringed with French knots, a large one at the point. */
  diamonds() {
    const out: Raw[] = [];
    const Lp: Pt = [176, 150];
    const M: Pt = [300, 278];
    const Rp: Pt = [424, 150];
    const rh = (cx: number, cy: number, hx: number, hy: number): Pt[] => [[cx, cy - hy], [cx + hx, cy], [cx, cy + hy], [cx - hx, cy], [cx, cy - hy]];
    const knots = (pts: Pt[], r: number) => pts.slice(0, -1).forEach((p) => out.push({ kind: 'dot', cx: p[0], cy: p[1], r }));
    const add = (cx: number, cy: number, big: boolean) => {
      const hx = big ? 9 : 5.5;
      const hy = big ? 12 : 7.5;
      out.push(satin(rh(cx, cy, hx, hy), 1.5));
      if (big) out.push(satin(rh(cx, cy, hx * 0.5, hy * 0.5), 1.1));
      knots(resample(rh(cx, cy, hx + 3.4, hy + 4.2), 3.4), 0.95);
    };
    const arm = (A: Pt, B: Pt, rev: boolean) => {
      const n = 7;
      for (let i = 0; i < n; i++) {
        const u = rev ? 1 - (i + 0.5) / (n + 0.4) : (i + 0.5) / (n + 0.4);
        add(lerp(A[0], B[0], u), lerp(A[1], B[1], u), i % 2 === 0);
      }
    };
    arm(Lp, M, false);
    out.push(satin(rh(M[0], M[1], 15, 20), 1.8), satin(rh(M[0], M[1], 8.25, 11), 1.3));
    knots(resample(rh(M[0], M[1], 19, 25), 3.6), 1.05);
    arm(Rp, M, true);
    return out;
  },
};

/* ---------- timeline ---------- */

/** Fractions of the run. Embroider close up, pull back, gather the pieces, sew, rest. */
export const TIMELINE = {
  emb: [0.03, 0.44] as const,
  pull: [0.4, 0.62] as const,
  draftIn: [0.42, 0.48] as const,
  draftOut: [0.64, 0.72] as const,
  glide: (k: number) => [0.48 + k * 0.038, 0.61 + k * 0.038] as const,
  seams: [0.74, 0.9] as const,
  buttons: [0.89, 0.93] as const,
  /** A raking light passes once across the finished embroidery. */
  glint: [0.9, 1] as const,
};
export const DURATION_MS = { wide: 10000, compact: 7000 };

export interface SatinEl { kind: 'satin'; w: number; base: Pt[]; zig: Pt[]; zcum: number[]; len: number; c: Pt; s: number; e: number }
export interface DotEl { kind: 'dot'; cx: number; cy: number; r: number; len: number; c: Pt; s: number; e: number }
export type StitchEl = SatinEl | DotEl;
export interface Seam { pts: Pt[]; cum: number[]; s: number; e: number }
export interface Scene {
  motif: Motif;
  host: PieceId;
  els: StitchEl[];
  /** Smoothed centres of the elements, for the camera to follow the needle. */
  follow: Pt[];
  /** Each element's own centre, for the loupe: it glides from stitch to stitch and always frames one. */
  near: Pt[];
  /** Cumulative length along `near`. */
  nearCum: number[];
  seams: Seam[];
}

/** Geometry and timing for one polo. Deterministic for a motif. */
export function buildScene(motif: Motif): Scene {
  const raw = MOTIFS[motif]();
  const els: StitchEl[] = raw.map((r) => {
    if (r.kind === 'dot') return { kind: 'dot', cx: r.cx, cy: r.cy, r: r.r, len: 3, c: [r.cx, r.cy], s: 0, e: 0 };
    const base = resample(r.pts, 0.8);
    const zig = zigzag(r.pts, r.w);
    const c = base.reduce<Pt>((a, p) => [a[0] + p[0] / base.length, a[1] + p[1] / base.length], [0, 0]);
    return { kind: 'satin', w: r.w, base, zig, zcum: cumul(zig), len: cumul(base).pop()!, c, s: 0, e: 0 };
  });
  // Time by stitch length, with some overlap, like a multi-head machine.
  const [ea, eb] = TIMELINE.emb;
  const span = eb - ea;
  const W = els.map((e) => (e.kind === 'dot' ? 3 : Math.max(8, e.len)));
  const tot = W.reduce((a, b) => a + b, 0);
  let acc = 0;
  els.forEach((e, i) => {
    e.s = ea + (span * 0.86 * acc) / tot;
    e.e = Math.min(eb, e.s + Math.max(span * 0.012, ((span * 0.86 * W[i]!) / tot) * 2.2));
    acc += W[i]!;
  });
  const smooth = (r: number) =>
    els.map((_, i) => {
      let x = 0;
      let y = 0;
      let n = 0;
      for (let j = Math.max(0, i - r); j <= Math.min(els.length - 1, i + r); j++) {
        x += els[j]!.c[0];
        y += els[j]!.c[1];
        n++;
      }
      return [x / n, y / n] as Pt;
    });
  const follow = smooth(4);
  const near = smooth(0);
  // Each seam group gets time in proportion to its longest seam.
  const groups = SEAM_GROUPS.map((g) => g.map((d) => sampleD(d)).map((pts) => ({ pts, cum: cumul(pts) })));
  const gl = groups.map((g) => Math.max(...g.map((s) => s.cum[s.cum.length - 1]!)));
  const gt = gl.reduce((a, b) => a + b, 0);
  const [sa, sb] = TIMELINE.seams;
  let gc = 0;
  const seams: Seam[] = [];
  groups.forEach((g, gi) => {
    const s = sa + ((sb - sa) * gc) / gt;
    const e = sa + ((sb - sa) * (gc + gl[gi]!)) / gt;
    gc += gl[gi]!;
    for (const one of g) seams.push({ ...one, s, e });
  });
  return { motif, host: MOTIF_HOST[motif], els, follow, near, nearCum: cumul(near.length ? near : [[0, 0]]), seams };
}

/* ---------- camera and frames ---------- */

export interface Cam { cx: number; cy: number; w: number }
export const FULL: Cam = { cx: 300, cy: 368, w: 580 };
const mixCam = (a: Cam, b: Cam, k: number): Cam => ({ cx: lerp(a.cx, b.cx, k), cy: lerp(a.cy, b.cy, k), w: Math.exp(lerp(Math.log(a.w), Math.log(b.w), k)) });

function followAt(scene: Scene, t: number, path: Pt[] = scene.follow): Pt {
  const els = scene.els;
  if (!els.length || t <= els[0]!.s) return path[0] ?? [FULL.cx, FULL.cy];
  let i = 0;
  while (i < els.length - 1 && els[i + 1]!.s <= t) i++;
  if (i >= els.length - 1) return path[els.length - 1]!;
  const k = clamp((t - els[i]!.s) / (els[i + 1]!.s - els[i]!.s || 1));
  const a = path[i]!;
  const b = path[i + 1]!;
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
}

/** Close on the needle while it embroiders, then a long pull back to the whole polo. */
export function camera(scene: Scene, t: number, compact: boolean): Cam {
  const f = followAt(scene, Math.min(t, TIMELINE.emb[1]));
  return mixCam({ cx: f[0], cy: f[1], w: compact ? 120 : 150 }, FULL, eio(seg(t, ...TIMELINE.pull)));
}

/** How much of the garment the loupe shows across: a few stitches. */
export const LOUPE_W = 64;
/** Average drift speed along the embroidery, garment units per second (about 30px/s on screen). */
export const LOUPE_SPEED = 6;

/**
 * The loupe beside the stage: it follows the needle, closer than the stage, while the embroidery is stitched;
 * then it drifts slowly along the finished embroidery and back, easing at each end. `drift` is seconds since
 * the stitching ended. It starts where the needle stopped, and always frames real stitches.
 */
export function loupeCamera(scene: Scene, t: number, drift: number): Cam {
  if (t < TIMELINE.emb[1] || scene.near.length < 2) {
    const f = followAt(scene, t, scene.near);
    return { cx: f[0], cy: f[1], w: LOUPE_W };
  }
  const cum = scene.nearCum;
  const L = cum[cum.length - 1]! || 1;
  // One pass along the path takes L / speed seconds; u runs 1 → 0 → 1 (end → start → end).
  const u = (1 + Math.cos((Math.PI * Math.max(0, drift) * LOUPE_SPEED) / L)) / 2;
  const p = pointAt(scene.near, cum, u);
  return { cx: p.x, cy: p.y, w: LOUPE_W };
}

/** The 6:7 camera frame, widened or heightened to fill a box of the given width / height. */
export function viewBoxFor(cam: Cam, aspect: number): string {
  let w = cam.w;
  let h = (cam.w * VIEW.h) / VIEW.w;
  if (aspect > w / h) w = h * aspect;
  else h = w / aspect;
  return `${r1(cam.cx - w / 2)} ${r1(cam.cy - h / 2)} ${r1(w)} ${r1(h)}`;
}

export interface PieceFrame { transform: string; opacity: number; drop: string; dropOpacity: number }
/** A cut piece's place at time t. The host piece (the embroidered one) is home from the start. */
export function pieceFrame(p: Piece, t: number, host: PieceId): PieceFrame {
  if (p.id === host) return { transform: '', opacity: 1, drop: 'translate(3 6)', dropOpacity: 0.22 };
  const [a, b] = TIMELINE.glide(p.k);
  const q = 1 - eo(seg(t, a, b));
  const [dx, dy, rot, sc] = p.from;
  const [cx, cy] = p.c;
  const s = 1 + (sc - 1) * q;
  let transform = q ? `translate(${r1(dx * q)} ${r1(dy * q)}) rotate(${r1(rot * q)} ${cx} ${cy})` : '';
  if (q && s !== 1) transform += ` translate(${cx} ${cy}) scale(${s.toFixed(4)}) translate(${-cx} ${-cy})`;
  // A lifted piece casts a longer, fainter shadow; it tightens under the piece as it is laid down.
  return { transform, opacity: seg(t, a, a + 0.015), drop: `translate(${r1(3 + 12 * q)} ${r1(6 + 20 * q)})`, dropOpacity: 0.22 - 0.06 * q };
}

/** Where the raking light's band sits at glint progress p (0…1): it crosses the garment from top left. */
export function glintTransform(p: number): string {
  const d = r1(lerp(40, 620, eio(clamp(p))));
  return `translate(${d} ${d})`;
}

export interface Tip { x: number; y: number; lift: number; s: number }
export interface Frame {
  viewBox: string;
  needleScale: number;
  draftOpacity: number;
  pieces: PieceFrame[];
  seams: number[];
  buttons: number[];
  els: number[];
  /** The raking light across the embroidery, 0 (not yet) … 1 (passed). */
  glint: number;
  /** Live needle positions, most recent first. */
  tips: Tip[];
}

/**
 * Everything the stage writes at time t (0…1). `aspect` is the stage box's width / height: the camera's 6:7
 * frame is widened (or heightened) to fill the box, so nothing spills out and nothing is letterboxed. `cam`
 * replaces the stage camera (the loupe passes its own).
 */
export function frame(scene: Scene, t: number, compact: boolean, aspect = VIEW.w / VIEW.h, cam: Cam = camera(scene, t, compact)): Frame {
  const tips: Tip[] = [];
  const seams = scene.seams.map((s) => {
    const p = seg(t, s.s, s.e);
    if (p > 0 && p < 1) {
      const tip = pointAt(s.pts, s.cum, p);
      tips.push({ x: tip.x, y: tip.y, lift: (Math.floor((p * s.cum[s.cum.length - 1]!) / 2.7) % 2) * 3.5, s: s.s });
    }
    return p;
  });
  const buttons = BUTTONS.map(([x, y], i) => {
    const a = TIMELINE.buttons[0] + i * 0.02;
    const p = seg(t, a, a + 0.025);
    if (p > 0 && p < 1) tips.push({ x: x + (p < 0.5 ? -1.3 : 1.3), y: y - 1.3, lift: (Math.floor(p * 6) % 2) * 4, s: a });
    return eo(p);
  });
  const els = scene.els.map((e) => {
    const p = seg(t, e.s, e.e);
    if (p > 0 && p < 1) {
      if (e.kind === 'satin') {
        const tip = pointAt(e.zig, e.zcum, p);
        tips.push({ x: tip.x, y: tip.y, lift: (tip.i % 2) * 3, s: e.s });
      } else tips.push({ x: e.cx, y: e.cy, lift: (1 - p) * 4, s: e.s });
    }
    return e.kind === 'dot' ? eo(p) : p;
  });
  tips.sort((a, b) => b.s - a.s);
  return {
    viewBox: viewBoxFor(cam, aspect),
    needleScale: (cam.w / FULL.w) * 1.1,
    draftOpacity: Math.round(seg(t, ...TIMELINE.draftIn) * (1 - seg(t, ...TIMELINE.draftOut)) * 10) / 10,
    pieces: PIECES.map((p) => pieceFrame(p, t, scene.host)),
    seams,
    buttons,
    els,
    glint: seg(t, ...TIMELINE.glint),
    tips,
  };
}

/** A seam sewn a fraction p of the way. */
export function seamPath(seam: Seam, p: number): string {
  if (p <= 0) return '';
  const tip = pointAt(seam.pts, seam.cum, p);
  return toD([...seam.pts.slice(0, tip.i + 1), [tip.x, tip.y]]);
}

/* ---------- markup ---------- */

/** Element id prefix for the stage SVG; the loupe passes its own (`LOUPE_ID`) so the two never clash. */
export const ID = 'nhs';
export const LOUPE_ID = 'nhl';

/**
 * The stage's inner SVG at t = 0. Built from numbers only (no product text), so it is safe to set as
 * markup. Colours come from CSS custom properties on the section (`--st-*`).
 */
export function sceneMarkup(scene: Scene, P: string = ID): string {
  // Light comes from the top left. The thread's own gradients run across each stitch's box, so every ring is
  // lit on its upper side and falls away below, as raised satin does; the glint is a band in garment space.
  const stops = (s: [number, string, number][]) => s.map(([o, c, a]) => `<stop offset="${o}" style="stop-color:var(--st-${c});stop-opacity:${a}"/>`).join('');
  let defs =
    `<filter id="${P}-drop" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>` +
    `<filter id="${P}-soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="9"/></filter>` +
    // Piqué: a lattice of small raised knots, each lit above and shaded below.
    `<pattern id="${P}-pique" width="3" height="2.6" patternUnits="userSpaceOnUse">` +
    `<ellipse cx=".8" cy=".85" rx=".7" ry=".5" class="st-pq-lo"/><ellipse cx=".7" cy=".6" rx=".55" ry=".38" class="st-pq-hi"/>` +
    `<ellipse cx="2.3" cy="2.15" rx=".7" ry=".5" class="st-pq-lo"/><ellipse cx="2.2" cy="1.9" rx=".55" ry=".38" class="st-pq-hi"/>` +
    `<ellipse cx="-.7" cy="2.15" rx=".7" ry=".5" class="st-pq-lo"/><ellipse cx="-.8" cy="1.9" rx=".55" ry=".38" class="st-pq-hi"/></pattern>` +
    // The yarn: fibre noise stretched along the wales, light and dark flecks over the cloth. Rendered once
    // per tile (stitched, so it repeats without a seam), cheap however the camera moves.
    `<filter id="${P}-yarn" filterUnits="userSpaceOnUse" x="0" y="0" width="60" height="60" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency="1.1 .38" numOctaves="2" seed="7" stitchTiles="stitch" result="n"/>` +
    `<feColorMatrix in="n" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 2.6 0 0 0 -1.35" result="w"/>` +
    `<feColorMatrix in="n" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2.6 0 0 0 1.2" result="k"/>` +
    `<feMerge><feMergeNode in="k"/><feMergeNode in="w"/></feMerge></filter>` +
    `<pattern id="${P}-fibre" width="60" height="60" patternUnits="userSpaceOnUse"><rect width="60" height="60" filter="url(#${P}-yarn)"/></pattern>` +
    `<pattern id="${P}-ribV" width="2.4" height="10" patternUnits="userSpaceOnUse"><line x1=".6" y1="0" x2=".6" y2="10" class="st-rib-lo"/><line x1="1.8" y1="0" x2="1.8" y2="10" class="st-rib-hi"/></pattern>` +
    `<pattern id="${P}-ribC" width="2.4" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(44)"><line x1=".6" y1="0" x2=".6" y2="10" class="st-rib-lo"/><line x1="1.8" y1="0" x2="1.8" y2="10" class="st-rib-hi"/></pattern>` +
    // The room light over the flat lay: brighter at the top left shoulder, falling off to the hem.
    `<linearGradient id="${P}-lit" gradientUnits="userSpaceOnUse" x1="150" y1="90" x2="470" y2="660"><stop offset="0" stop-color="#fff" stop-opacity=".09"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".34"/></linearGradient>` +
    `<radialGradient id="${P}-sheen" gradientUnits="userSpaceOnUse" cx="250" cy="250" r="230"><stop offset="0" stop-color="#fff" stop-opacity=".07"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="${P}-thr" x1="0" y1="0" x2="1" y2="1">${stops([[0, 'thread-hi', 1], [0.42, 'thread', 1], [1, 'thread-lo', 1]])}</linearGradient>` +
    `<linearGradient id="${P}-shn" x1="0" y1="0" x2="1" y2="1">${stops([[0, 'thread-hi', 1], [0.5, 'thread-hi', 0.3], [0.85, 'thread-hi', 0]])}</linearGradient>` +
    `<radialGradient id="${P}-knot" fx=".34" fy=".3">${stops([[0, 'thread-hi', 1], [0.6, 'thread', 1], [1, 'thread-lo', 1]])}</radialGradient>` +
    `<linearGradient id="${P}-glint" gradientUnits="userSpaceOnUse" x1="-110" y1="-110" x2="0" y2="0" gradientTransform="${glintTransform(0)}">` +
    `<stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<clipPath id="${P}-clipBody"><path d="${BODY}"/></clipPath><clipPath id="${P}-clipSleeve"><path d="${SLEEVE}"/></clipPath>`;
  const emb: string[] = scene.els.map((e, i) => {
    if (e.kind === 'satin') {
      defs += `<path id="${P}-b${i}" d="${toD(e.base)}" pathLength="1000"/><path id="${P}-z${i}" d="${toD(e.zig)}" pathLength="1000"/>`;
      return (
        `<g id="${P}-e${i}" class="st-run" style="stroke-dashoffset:1000;opacity:0">` +
        `<use href="#${P}-b${i}" class="st-shadow" transform="translate(.35 .55)" style="stroke-width:${r1(e.w * 1.15)}"/>` +
        `<use href="#${P}-b${i}" class="st-base" style="stroke-width:${r1(e.w * 0.85)}"/>` +
        `<use href="#${P}-z${i}" class="st-thread" style="stroke:url(#${P}-thr) var(--st-thread)"/>` +
        `<use href="#${P}-z${i}" class="st-sheen" transform="translate(-.25 -.3)" style="stroke:url(#${P}-shn) var(--st-thread-hi)"/>` +
        `<use href="#${P}-z${i}" class="st-glint" style="stroke:url(#${P}-glint) transparent"/></g>`
      );
    }
    return (
      `<g id="${P}-e${i}" transform="translate(${r1(e.cx)} ${r1(e.cy)}) scale(0)">` +
      `<circle r="${r1(e.r * 1.05)}" cx=".5" cy=".7" class="st-knot-shadow"/><circle r="${r1(e.r)}" class="st-knot" style="fill:url(#${P}-knot) var(--st-thread)"/>` +
      `<circle r="${r1(e.r * 0.3)}" cx="${r1(-e.r * 0.34)}" cy="${r1(-e.r * 0.38)}" class="st-knot-sheen"/></g>`
    );
  });
  const folds = {
    // Soft drape: two long folds, a ridge of light down the front, the shadow the collar casts, the pull at the
    // underarm and a lift where the hem turns up.
    body:
      `<g clip-path="url(#${P}-clipBody)">` +
      `<path class="st-fold" filter="url(#${P}-soft)" d="M212 280 C222 400 208 520 218 650"/><path class="st-fold" filter="url(#${P}-soft)" d="M394 300 C384 420 398 520 388 650"/>` +
      `<path class="st-light" filter="url(#${P}-soft)" d="M300 250 C296 380 306 500 300 640"/><path class="st-light st-light-thin" filter="url(#${P}-soft)" d="M176 300 C190 420 182 540 186 630"/>` +
      `<path class="st-fold st-fold-thin" filter="url(#${P}-soft)" d="M244 112 C272 140 328 140 356 112"/>` +
      `<path class="st-fold st-fold-thin" filter="url(#${P}-soft)" d="M150 268 C176 286 186 312 182 344"/><path class="st-fold st-fold-thin" filter="url(#${P}-soft)" d="M450 268 C424 286 414 312 418 344"/>` +
      `<path class="st-light st-light-thin" filter="url(#${P}-soft)" d="M150 618 C250 610 350 610 452 618"/></g>`,
    sleeve: `<g clip-path="url(#${P}-clipSleeve)"><path class="st-fold" filter="url(#${P}-soft)" d="M152 150 C126 196 108 236 96 284"/><path class="st-light st-light-thin" filter="url(#${P}-soft)" d="M140 132 C112 160 90 196 70 236"/></g>`,
  };
  const pieces = PIECES.map((p) => {
    const inner =
      `<path d="${p.d}" class="st-drop" filter="url(#${P}-drop)" transform="translate(3 6)"/>` +
      `<path d="${p.d}" class="st-cloth"/><path d="${p.d}" fill="url(#${P}-${p.tex})" class="st-tex"/>` +
      `<path d="${p.d}" fill="url(#${P}-fibre)" class="st-fibre"/>` +
      (p.folds ? folds[p.folds] : '');
    // The room light is fixed to the garment, not to the piece's drawing, so mirrored pieces are lit the same way.
    const world = p.mirror ? mirrorD(p.d) : p.d;
    const light = `<path d="${world}" fill="url(#${P}-lit)"/><path d="${world}" fill="url(#${P}-sheen)"/><path d="${world}" class="st-edge"/>`;
    const own = p.id === scene.host ? emb.join('') : '';
    return `<g id="${P}-pc-${p.id}">${p.mirror ? `<g transform="${MIRROR}">${inner}</g>` : inner}${light}<g>${own}</g></g>`;
  }).join('');
  const draft = PIECES.map((p) => `<path d="${p.mirror ? mirrorD(p.d) : p.d}" class="st-draft"/>`).join('');
  // A sewn seam pulls the cloth into a shallow valley; the topstitch runs along its edge.
  const seams = scene.seams.map((_, i) => `<path id="${P}-sv${i}" class="st-seam-valley" d=""/><path id="${P}-s${i}" class="st-seam" d=""/>`).join('');
  const buttons = BUTTONS.map(
    ([x, y], i) =>
      `<g id="${P}-bt${i}" transform="translate(${x} ${y}) scale(0)"><circle r="4.6" class="st-button"/>` +
      `<line x1="-1.3" y1="-1.3" x2="1.3" y2="1.3" class="st-button-x"/><line x1="1.3" y1="-1.3" x2="-1.3" y2="1.3" class="st-button-x"/>` +
      `<circle r=".55" cx="-1.3" cy="-1.3" class="st-button-hole"/><circle r=".55" cx="1.3" cy="-1.3" class="st-button-hole"/>` +
      `<circle r=".55" cx="-1.3" cy="1.3" class="st-button-hole"/><circle r=".55" cx="1.3" cy="1.3" class="st-button-hole"/></g>`,
  ).join('');
  const needle = (i: number) =>
    `<g id="${P}-nd${i}" style="opacity:0"><path class="st-needle-thread" d="M12.2 -35 C30 -70 34 -140 90 -320"/>` +
    `<line class="st-needle-edge" x1="0" y1="0" x2="13" y2="-38"/><line class="st-needle" x1=".3" y1="-1" x2="12.7" y2="-37"/>` +
    `<ellipse class="st-needle-eye" cx="12.2" cy="-34.6" rx=".55" ry="2.2" transform="rotate(19 12.2 -34.6)"/></g>`;
  return `<defs>${defs}</defs><g id="${P}-draft" style="opacity:0">${draft}</g><g>${pieces}</g><g>${seams}</g><g>${buttons}</g>${needle(0)}${needle(1)}`;
}
