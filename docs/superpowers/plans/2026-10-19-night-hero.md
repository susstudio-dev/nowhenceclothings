# Night Hero ("eyes in the dark") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Panther Polo's home hero opens dark on the real macro photograph. Two panther eyes watch a pointer torch, the real rosettes stitch themselves into the cloth, and the light comes up on the finished embroidery.

**Architecture:** An offline Node + sharp script turns the macro photo into three textures per crop: embroidered, bare cloth, and a 16-bit stitch-order map. A pure `lib/night-hero.ts` holds the registry, timeline, cover fit and torch drift. A client `NightStage` lazy-loads Three.js (one full-screen `ShaderMaterial`) and anime.js (the timeline). A server `NightHero` renders the poster, copy and action. `page.tsx` picks `NightHero` when the lead motif has assets, and `StitchHero` otherwise.

**Tech Stack:** Next.js 15 app router, React 19, Tailwind 3, three@0.170.0, animejs@4.0.2, sharp@0.35.5 (dev), Vitest.

Spec: `docs/superpowers/specs/2026-10-19-night-hero-design.md`. Prototype: https://claude.ai/artifact/VJLYXNAZ1WSdcwXkKaWdq1

## Global Constraints
- Timeline: 11 s at ≥ 768px, 8 s under 768px, same beats scaled.
- Plays once per browser session (`sessionStorage` key `nh-night-played`, guarded by try/catch). Later visits start lit, with no eyes.
- `prefers-reduced-motion`, no WebGL, or a texture failure: the poster only (no canvas, no eyes).
- Copy and action are server-rendered and visible from the first frame. The timeline never hides them.
- Three.js and anime.js are imported dynamically, inside `NightStage` only.
- Pixel ratio cap: 2, or 1.5 under 768px. Textures have no mipmaps; the order map uses nearest filtering.
- Every `src/lib` module gets a `*.test.ts`. Done = `npm run typecheck && npm test` green, plus `npm run build`.
- Never stage `public/_headers` (an untracked owner file).

---

### Task 1: Texture prep script and generated assets

**Files:**
- Create: `scripts/prep-night-hero.mjs`
- Create (generated): `public/hero/rings/{wide,tall}/{full.webp,bare.webp,order.png}`
- Modify: `package.json` (deps already installed: three, animejs, @types/three, sharp)

**Interfaces:**
- Produces: the asset paths `/hero/<motif>/<crop>/{full.webp,bare.webp,order.png}`. Wide is 1600 × 900; tall is 1280 × 1600. Order map: R = high byte, G = low byte of `round(t · 65535)`, B = 255 on thread, else 0. t = 0 means not thread; thread pixels get t ≥ 1/65535.

- [ ] **Step 1: Write the script** (a port of the prototype's Python prep, `scratchpad/tools/prep.py`)

```js
// Prepares the home night hero's textures from a macro photograph (docs/superpowers/specs/2026-10-19-night-hero-design.md).
// Run by hand; its output is committed. Usage: node scripts/prep-night-hero.mjs <source image> <motif>
// Per crop: full.webp (the photograph), bare.webp (the thread replaced by nearby piqué) and order.png
// (R,G = 16-bit time each thread pixel is sewn, B = thread). Must stay in step with decodeOrder in src/lib/night-hero.ts.
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const CROPS = {
  wide: { left: 0, top: 380, width: 1600, height: 900 },
  tall: { left: 320, top: 300, width: 1280, height: 1600 },
};
const [src, motif] = process.argv.slice(2);
if (!src || !motif) throw new Error('usage: node scripts/prep-night-hero.mjs <source image> <motif>');

function dilate(m, W, H, r) {
  const tmp = new m.constructor(m.length), out = new m.constructor(m.length);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let v = 0;
      for (let k = Math.max(0, x - r), e = Math.min(W - 1, x + r); k <= e; k++) if (m[y * W + k] > v) v = m[y * W + k];
      tmp[y * W + x] = v;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let v = 0;
      for (let k = Math.max(0, y - r), e = Math.min(H - 1, y + r); k <= e; k++) if (tmp[k * W + x] > v) v = tmp[k * W + x];
      out[y * W + x] = v;
    }
  return out;
}

function components(m, W, H) {
  const seen = new Uint8Array(m.length), stack = new Int32Array(m.length), out = [];
  for (let s = 0; s < m.length; s++) {
    if (!m[s] || seen[s]) continue;
    let top = 0, n = 0;
    const pts = [];
    stack[top++] = s; seen[s] = 1;
    while (top) {
      const i = stack[--top]; pts.push(i); n++;
      const x = i % W, y = (i / W) | 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const j = yy * W + xx;
          if (m[j] && !seen[j]) { seen[j] = 1; stack[top++] = j; }
        }
    }
    out.push(Int32Array.from(pts));
  }
  return out;
}

function rng(seed) {
  return () => ((seed = (seed + 0x6d2b79f5) | 0), (((seed ^ (seed >>> 15)) * (1 | seed)) >>> 0) / 4294967296);
}

async function prep(box, out) {
  const { data: rgb, info } = await sharp(src).extract(box).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, N = W * H;
  const grey = new Uint8Array(N);
  for (let i = 0; i < N; i++) grey[i] = Math.round(0.299 * rgb[3 * i] + 0.587 * rgb[3 * i + 1] + 0.114 * rgb[3 * i + 2]);
  const blur = async (u8, sigma) =>
    new Uint8Array(await sharp(Buffer.from(u8), { raw: { width: W, height: H, channels: 1 } }).blur(sigma).extractChannel(0).raw().toBuffer());
  const a = await blur(grey, 3), bg = await blur(grey, 40);

  // Thread is a little lighter than the cloth around it; the grey wall behind the polo is excluded.
  const wall = new Uint8Array(N), raw = new Uint8Array(N), loose = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const d = a[i] - bg[i];
    wall[i] = bg[i] > 80 ? 1 : 0;
    raw[i] = d > 6 && !wall[i] ? 1 : 0;
    loose[i] = (d > 3 || d < -4) && !wall[i] ? 1 : 0;
  }
  const wallNear = dilate(wall, W, H, 15);
  const keep = components(raw, W, H).filter((p) => {
    if (p.length < 120) return false;
    let x0 = W, x1 = 0, y0 = H, y1 = 0;
    for (const i of p) {
      const x = i % W, y = (i / W) | 0;
      if (wallNear[i]) return false;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    return Math.max(w, h) / Math.min(w, h) <= 2.6 && Math.max(w, h) <= 380;
  });
  const thread = new Uint8Array(N);
  for (const p of keep) for (const i of p) thread[i] = 1;
  const threadD = dilate(thread, W, H, 3);

  // What leaves the bare cloth: every thread-like blob plus its shadow halo.
  const seed = new Uint8Array(N);
  for (let i = 0; i < N; i++) seed[i] = raw[i] | thread[i];
  const near = dilate(seed, W, H, 7);
  const pre = new Uint8Array(N);
  for (let i = 0; i < N; i++) pre[i] = seed[i] || (loose[i] && near[i]) ? 1 : 0;
  const remove = dilate(pre, W, H, 4);

  // Bare cloth: copy piqué from the nearest clean offset, then feather the patch into the photograph.
  const bare = Uint8Array.from(rgb);
  let todo = [];
  for (let i = 0; i < N; i++) if (remove[i]) todo.push(i);
  for (const r of [40, 56, 72, 96, 128, 170, 220])
    for (let ang = 0; ang < 360; ang += 30) {
      const dy = Math.round(r * Math.sin((ang * Math.PI) / 180)), dx = Math.round(r * Math.cos((ang * Math.PI) / 180));
      todo = todo.filter((i) => {
        const x = Math.min(W - 1, Math.max(0, (i % W) + dx)), y = Math.min(H - 1, Math.max(0, ((i / W) | 0) + dy));
        const j = y * W + x;
        if (remove[j]) return true;
        bare[3 * i] = rgb[3 * j]; bare[3 * i + 1] = rgb[3 * j + 1]; bare[3 * i + 2] = rgb[3 * j + 2];
        return false;
      });
    }
  const soft = await blur(remove.map((v) => v * 255), 2);
  for (let i = 0; i < N; i++)
    for (let c = 0; c < 3; c++) bare[3 * i + c] = Math.round(rgb[3 * i + c] * (1 - soft[i] / 255) + bare[3 * i + c] * (soft[i] / 255));

  // Stitch order: rosettes flow from the collar (top right) down; each is traced round its ring from a random start.
  const ros = keep.map((p) => {
    let sx = 0, sy = 0;
    for (const i of p) { sx += i % W; sy += (i / W) | 0; }
    return { p, cx: sx / p.length, cy: sy / p.length };
  });
  ros.sort((u, v) => u.cy - 0.35 * u.cx - (v.cy - 0.35 * v.cx));
  const rand = rng(3), dur = 0.16, span = 1 - dur;
  const lab = new Int32Array(N);
  ros.forEach((r, k) => {
    r.t0 = (span * k) / Math.max(1, ros.length - 1);
    r.a0 = rand() * 2 * Math.PI;
    for (const i of r.p) lab[i] = k + 1;
  });
  const labD = dilate(lab, W, H, 3);
  const order = Buffer.alloc(N * 3);
  for (let i = 0; i < N; i++) {
    if (!threadD[i] || !labD[i]) continue;
    const r = ros[labD[i] - 1], x = i % W, y = (i / W) | 0;
    const f = (((Math.atan2(y - r.cy, x - r.cx) - r.a0) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / (2 * Math.PI);
    const q = Math.max(1, Math.min(65535, Math.round((r.t0 + dur * f) * 65535)));
    order[3 * i] = q >> 8; order[3 * i + 1] = q & 255; order[3 * i + 2] = 255;
  }

  await mkdir(out, { recursive: true });
  const rawOpts = { raw: { width: W, height: H, channels: 3 } };
  await sharp(rgb, rawOpts).webp({ quality: 86 }).toFile(`${out}/full.webp`);
  await sharp(Buffer.from(bare), rawOpts).webp({ quality: 86 }).toFile(`${out}/bare.webp`);
  await sharp(order, rawOpts).png({ compressionLevel: 9 }).toFile(`${out}/order.png`);
  console.log(out, `${W}×${H}`, `${ros.length} rosettes`);
}

for (const [name, box] of Object.entries(CROPS)) await prep(box, `public/hero/${motif}/${name}`);
```

- [ ] **Step 2: Run it**

Run: `node scripts/prep-night-hero.mjs public/media/seed-02771980b22260fb/1600.webp rings`
Expected: two lines, `public/hero/rings/wide 1600×900 ~38 rosettes` and `public/hero/rings/tall 1280×1600 ~40 rosettes`.

- [ ] **Step 3: Check the output visually.** Brighten `full.webp` and `bare.webp` (×2.6) side by side for each crop and confirm that bare has no rosettes and no dark halos, and that the tall crop shows no grey wall in its corners. If wall shows, move the `tall` box right or down within the 1600 × 2000 source, keeping 4:5.

- [ ] **Step 4: Commit**

```bash
git add scripts/prep-night-hero.mjs public/hero package.json package-lock.json
git commit -m "feat(hero): night hero texture prep and panther assets"
```

---

### Task 2: `lib/night-hero.ts` (registry, timeline, cover fit, drift, order decoding)

**Files:**
- Create: `src/lib/night-hero.ts`
- Test: `src/lib/night-hero.test.ts`

**Interfaces:**
- Consumes: `type Motif` from `src/lib/stitch-hero.ts`.
- Produces: `type Crop = 'wide' | 'tall'`; `NightCrop { full; bare; order; w; h }`; `NightHeroEntry { lines: readonly [string, string]; crops: Record<Crop, NightCrop>; eyes: Record<Crop, { x; y; w }>; eyesImage?: string }`; `nightHeroFor(motif?: Motif): NightHeroEntry | undefined`; `coverScale(stageAspect, imageAspect): [number, number]`; `encodeOrder(t): [number, number]`; `decodeOrder(r, g): number`; `driftAt(seconds): [number, number]`; `type Beat`; `NIGHT_MS = { wide: 11000, compact: 8000 }`; `timelineFor(compact: boolean): Record<Beat, { at: number; dur: number }>`; `NIGHT_DARK`, `NIGHT_LIT` (`{ prog, amb, torch, rad }`); `TORCH_RAD = 0.17`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { NIGHT_DARK, NIGHT_LIT, NIGHT_MS, coverScale, decodeOrder, driftAt, encodeOrder, nightHeroFor, timelineFor } from './night-hero';

describe('nightHeroFor', () => {
  it('has prepared photographs for the panther only', () => {
    const e = nightHeroFor('rings')!;
    expect(e.crops.wide).toMatchObject({ full: '/hero/rings/wide/full.webp', bare: '/hero/rings/wide/bare.webp', order: '/hero/rings/wide/order.png', w: 1600, h: 900 });
    expect(e.crops.tall.w / e.crops.tall.h).toBeCloseTo(0.8);
    expect(e.lines).toHaveLength(2);
    for (const m of ['wing', 'rain', 'pebbles', 'diamonds'] as const) expect(nightHeroFor(m)).toBeUndefined();
    expect(nightHeroFor(undefined)).toBeUndefined();
  });
  it('places the eyes inside the stage', () => {
    for (const p of Object.values(nightHeroFor('rings')!.eyes)) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x + p.w).toBeLessThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThan(1);
    }
  });
});

describe('coverScale', () => {
  it('crops top and bottom on a wider stage, the sides on a narrower one', () => {
    expect(coverScale(2, 16 / 9)).toEqual([1, 16 / 9 / 2]);
    expect(coverScale(0.8, 16 / 9)).toEqual([0.8 / (16 / 9), 1]);
    expect(coverScale(16 / 9, 16 / 9)).toEqual([1, 1]);
  });
});

describe('order map encoding', () => {
  it('round-trips through two bytes', () => {
    for (const t of [0, 1 / 65535, 0.25, 0.5, 0.84, 1]) {
      const [r, g] = encodeOrder(t);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(255);
      expect(g).toBeLessThanOrEqual(255);
      expect(decodeOrder(r, g)).toBeCloseTo(t, 4);
    }
    expect(encodeOrder(2)).toEqual([255, 255]);
    expect(encodeOrder(-1)).toEqual([0, 0]);
  });
});

describe('driftAt', () => {
  it('keeps the idle torch inside the stage', () => {
    for (let s = 0; s < 120; s += 0.37) {
      const [x, y] = driftAt(s);
      expect(x).toBeGreaterThan(0.2);
      expect(x).toBeLessThan(0.9);
      expect(y).toBeGreaterThan(0.2);
      expect(y).toBeLessThan(0.8);
    }
  });
});

describe('timelineFor', () => {
  it('ends on the duration for each width', () => {
    for (const compact of [false, true]) {
      const t = timelineFor(compact);
      const end = Math.max(...Object.values(t).map((b) => b.at + b.dur));
      expect(end).toBe(compact ? NIGHT_MS.compact : NIGHT_MS.wide);
    }
  });
  it('scales the phone beats from the desktop ones', () => {
    const w = timelineFor(false), c = timelineFor(true), k = NIGHT_MS.compact / NIGHT_MS.wide;
    expect(c.stitch.at).toBe(Math.round(w.stitch.at * k));
    expect(c.stitch.dur).toBe(Math.round(w.stitch.dur * k));
  });
  it('stitches after the light comes on and before the room lights up', () => {
    const t = timelineFor(false);
    expect(t.stitch.at).toBeGreaterThanOrEqual(t.torchOn.at + t.torchOn.dur);
    expect(t.lightUp.at).toBeLessThanOrEqual(t.stitch.at + t.stitch.dur);
    expect(t.eyesOut.at).toBeGreaterThan(t.blink.at);
  });
});

describe('rest states', () => {
  it('starts dark and unsewn, ends lit and sewn', () => {
    expect(NIGHT_DARK).toMatchObject({ prog: 0, torch: 0 });
    expect(NIGHT_LIT).toMatchObject({ prog: 1, torch: 1 });
    expect(NIGHT_LIT.amb).toBeGreaterThan(NIGHT_DARK.amb);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/lib/night-hero.test.ts`
Expected: FAIL, with "Failed to resolve import ./night-hero".

- [ ] **Step 3: Implement**

```ts
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
```

Note: `Math.round(10100*k) + Math.round(900*k)` = 7345 + 655 = 8000 and `Math.round(9400*k)+Math.round(1600*k)` = 6836 + 1164 = 8000, so the end test holds exactly.

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/lib/night-hero.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/night-hero.ts src/lib/night-hero.test.ts
git commit -m "feat(hero): night hero registry, timeline and cover fit"
```

---

### Task 3: Shader and the client stage

**Files:**
- Create: `src/lib/night-hero-shader.ts`, `src/lib/night-hero-shader.test.ts`
- Create: `src/components/shop/NightStage.tsx`

**Interfaces:**
- Consumes: everything Task 2 produces.
- Produces: `VERTEX`, `FRAGMENT` (GLSL strings), `UNIFORMS` (readonly name list); `<NightStage entry={NightHeroEntry} />` renders an absolutely positioned canvas and eyes, to be placed inside a `position: relative` section that it uses as its pointer host and size reference.

- [ ] **Step 1: Write the failing shader test**

```ts
import { describe, expect, it } from 'vitest';
import { FRAGMENT, UNIFORMS, VERTEX } from './night-hero-shader';

describe('night hero shader', () => {
  it('declares every uniform the stage sets', () => {
    for (const u of UNIFORMS) expect(FRAGMENT).toMatch(new RegExp(`\\b${u}\\b`));
  });
  it('decodes the order map as the prep script encodes it', () => {
    expect(FRAGMENT).toContain('(o.r * 65280.0 + o.g * 255.0) / 65535.0');
  });
  it('passes uv through the vertex stage', () => {
    expect(VERTEX).toContain('vUv = uv');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/lib/night-hero-shader.test.ts`
Expected: FAIL, with "Failed to resolve import ./night-hero-shader".

- [ ] **Step 3: Write the shader module**

```ts
// The night hero's full-screen shader (docs/superpowers/specs/2026-10-19-night-hero-design.md): the bare cloth
// becomes the embroidered photograph pixel by pixel as uProg passes each thread pixel's time in the order map,
// lit by an ambient term, a pointer torch and its wider raking falloff.

export const UNIFORMS = ['uBare', 'uFull', 'uOrder', 'uRes', 'uLight', 'uCover', 'uProg', 'uAmb', 'uTorch', 'uRad', 'uSeed'] as const;

export const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

export const FRAGMENT = /* glsl */ `
uniform sampler2D uBare;
uniform sampler2D uFull;
uniform sampler2D uOrder;
uniform vec2 uRes;
uniform vec2 uLight;
uniform vec2 uCover;
uniform float uProg;
uniform float uAmb;
uniform float uTorch;
uniform float uRad;
uniform float uSeed;
varying vec2 vUv;

float grain(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  vec2 uv = (vUv - 0.5) * uCover + 0.5;
  vec3 bare = texture2D(uBare, uv).rgb;
  vec3 full = texture2D(uFull, uv).rgb;
  vec4 o = texture2D(uOrder, uv);
  float t = (o.r * 65280.0 + o.g * 255.0) / 65535.0;
  float thread = step(0.5, o.b);
  float sewn = thread * (1.0 - smoothstep(uProg - 0.003, uProg, t));
  vec3 col = mix(bare, full, sewn);
  // The newest thread, where the needle is, catches a warm glint.
  float fresh = sewn * (1.0 - smoothstep(0.0, 0.016, uProg - t)) * step(uProg, 0.999);
  vec2 p = (vUv - uLight) * vec2(uRes.x / uRes.y, 1.0);
  float d2 = dot(p, p);
  float torch = uTorch * exp(-d2 / (uRad * uRad));
  float rake = uTorch * exp(-d2 / (uRad * uRad * 5.0));
  col *= uAmb + torch * 2.1 + rake * 0.35;
  col += sewn * torch * vec3(0.09, 0.085, 0.075);
  col += fresh * vec3(1.0, 0.82, 0.55) * (0.25 + torch * 0.8);
  col *= mix(0.45, 1.0, smoothstep(1.25, 0.25, length((vUv - 0.5) * vec2(1.5, 1.0))));
  col += (grain(vUv * uRes + uSeed) - 0.5) * 0.018;
  gl_FragColor = vec4(col, 1.0);
}`;
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/lib/night-hero-shader.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write `NightStage.tsx`**

```tsx
'use client';
import { useEffect, useId, useRef } from 'react';
import { NIGHT_DARK, NIGHT_LIT, TORCH_RAD, coverScale, driftAt, timelineFor, type Crop, type NightHeroEntry } from '@/lib/night-hero';
import { FRAGMENT, VERTEX } from '@/lib/night-hero-shader';

/** Session flag: the sequence plays once per visit; later views start lit. */
const PLAYED_KEY = 'nh-night-played';
/** After this long without the pointer, the torch wanders on its own. */
const IDLE_MS = 2200;
const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);

/**
 * The night hero's live layer (docs/superpowers/specs/2026-10-19-night-hero-design.md): one Three.js plane whose
 * shader stitches the real embroidery into the real cloth under a pointer torch, timed by an anime.js timeline.
 * Both libraries load after mount. The section's poster stays visible until all textures are in, and stays as the
 * whole hero under reduced motion or without WebGL. One rAF loop copies the timeline's state into the uniforms
 * (anime's update callback does not fire on seek), so React never re-renders per frame.
 */
export function NightStage({ entry }: { entry: NightHeroEntry }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const eyesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const eyes = eyesRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !eyes || !host) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const [{ LinearFilter, Mesh, NearestFilter, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, TextureLoader, Vector2, WebGLRenderer }, { createTimeline }] =
        await Promise.all([import('three'), import('animejs')]);
      if (disposed) return;
      const compact = window.matchMedia('(max-width: 767px)').matches;
      const crop: Crop = compact ? 'tall' : 'wide';
      const src = entry.crops[crop];

      let renderer: InstanceType<typeof WebGLRenderer>;
      try {
        renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
      } catch {
        return; // no WebGL: the poster is the hero
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.5 : 2));
      const loader = new TextureLoader();
      const load = (url: string, nearest = false) =>
        loader.loadAsync(url).then((t) => {
          t.minFilter = t.magFilter = nearest ? NearestFilter : LinearFilter;
          t.generateMipmaps = false;
          return t;
        });
      let textures;
      try {
        textures = await Promise.all([load(src.bare), load(src.full), load(src.order, true)]);
      } catch {
        renderer.dispose();
        return;
      }
      if (disposed) {
        textures.forEach((t) => t.dispose());
        renderer.dispose();
        return;
      }
      const [bare, full, order] = textures;

      let played = false;
      try {
        played = sessionStorage.getItem(PLAYED_KEY) === '1';
        sessionStorage.setItem(PLAYED_KEY, '1');
      } catch {
        /* storage blocked: play */
      }
      const state = { ...(played ? NIGHT_LIT : NIGHT_DARK) };
      const U = {
        uBare: { value: bare },
        uFull: { value: full },
        uOrder: { value: order },
        uRes: { value: new Vector2(1, 1) },
        uLight: { value: new Vector2(0.6, 0.5) },
        uCover: { value: new Vector2(1, 1) },
        uProg: { value: state.prog },
        uAmb: { value: state.amb },
        uTorch: { value: state.torch },
        uRad: { value: state.rad },
        uSeed: { value: 0 },
      };
      const material = new ShaderMaterial({ uniforms: U, vertexShader: VERTEX, fragmentShader: FRAGMENT });
      const geometry = new PlaneGeometry(2, 2);
      const scene = new Scene();
      scene.add(new Mesh(geometry, material));
      const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

      const size = () => {
        const r = host.getBoundingClientRect();
        if (!r.width || !r.height) return;
        renderer.setSize(r.width, r.height, false);
        U.uRes.value.set(r.width, r.height);
        U.uCover.value.set(...coverScale(r.width / r.height, src.w / src.h));
      };
      size();
      const ro = new ResizeObserver(size);
      ro.observe(host);

      // The torch: eased toward the pointer (or a drag on touch), wandering when idle.
      let tx = 0.62, ty = 0.48, px = tx, py = ty, last = -Infinity;
      const onPointer = (e: PointerEvent) => {
        const r = host.getBoundingClientRect();
        tx = (e.clientX - r.left) / r.width;
        ty = (e.clientY - r.top) / r.height;
        last = performance.now();
      };
      host.addEventListener('pointermove', onPointer);
      host.addEventListener('pointerdown', onPointer);

      const lids = eyes.querySelector<HTMLElement | SVGElement>('[data-lids]');
      const pupils = eyes.querySelectorAll<SVGGElement>('[data-pupil]');
      const at = entry.eyes[crop];
      const b = timelineFor(compact);
      let done = played;
      const tl = createTimeline({ autoplay: false, defaults: { ease: 'inOutSine' }, onComplete: () => void (done = true) });
      if (!played) {
        tl.add(eyes, { opacity: [0, 1], duration: b.eyesIn.dur, ease: 'outQuad' }, b.eyesIn.at)
          .add(state, { torch: [0, 1], rad: [NIGHT_DARK.rad, TORCH_RAD], duration: b.torchOn.dur }, b.torchOn.at)
          .add(state, { prog: [0, 1], duration: b.stitch.dur, ease: 'inOutQuad' }, b.stitch.at)
          .add(state, { amb: [NIGHT_DARK.amb, NIGHT_LIT.amb], rad: [TORCH_RAD, NIGHT_LIT.rad], duration: b.lightUp.dur, ease: 'inOutCubic' }, b.lightUp.at)
          .add(eyes, { opacity: [1, 0], duration: b.eyesOut.dur, ease: 'inQuad' }, b.eyesOut.at);
        if (lids) {
          const q = b.blink.dur / 4;
          tl.add(lids, { scaleY: [0.04, 1], duration: b.lidsOpen.dur, ease: 'outBack' }, b.lidsOpen.at)
            .add(lids, { scaleY: [1, 0.06], duration: q, ease: 'inOutQuad' }, b.blink.at)
            .add(lids, { scaleY: [0.06, 1], duration: q, ease: 'inOutQuad' }, b.blink.at + q)
            .add(lids, { scaleY: [1, 0.06], duration: 2 * q, ease: 'inOutQuad' }, b.blink.at + 2 * q);
        }
      }

      // Off screen: stop drawing and hold the sequence where it is.
      let visible = true;
      const io = new IntersectionObserver(([e]) => {
        visible = Boolean(e?.isIntersecting);
        if (!done) visible ? tl.play() : tl.pause();
      });
      io.observe(host);

      const t0 = performance.now();
      let raf = 0;
      const draw = (now: number) => {
        if (now - last > IDLE_MS) [tx, ty] = driftAt((now - t0) / 1000);
        px += (tx - px) * 0.09;
        py += (ty - py) * 0.09;
        U.uProg.value = state.prog;
        U.uAmb.value = state.amb;
        U.uTorch.value = state.torch;
        U.uRad.value = state.rad;
        U.uLight.value.set(px, 1 - py);
        U.uSeed.value = (now % 10000) / 10;
        const dx = clamp((px - (at.x + at.w / 2)) * 30, -14, 14), dy = clamp((py - at.y) * 20, -8, 8);
        pupils.forEach((p) => p.setAttribute('transform', `translate(${dx} ${dy})`));
        renderer.render(scene, camera);
      };
      const loop = (now: number) => {
        raf = requestAnimationFrame(loop);
        if (visible) draw(now);
      };
      draw(t0);
      canvas.dataset.ready = '';
      if (!played) tl.play();
      raf = requestAnimationFrame(loop);

      cleanup = () => {
        cancelAnimationFrame(raf);
        tl.revert();
        ro.disconnect();
        io.disconnect();
        host.removeEventListener('pointermove', onPointer);
        host.removeEventListener('pointerdown', onPointer);
        textures.forEach((t) => t.dispose());
        material.dispose();
        geometry.dispose();
        renderer.dispose();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [entry]);

  const pos = {
    '--eye-x': `${entry.eyes.tall.x * 100}%`,
    '--eye-y': `${entry.eyes.tall.y * 100}%`,
    '--eye-w': `${entry.eyes.tall.w * 100}%`,
    '--eye-x-md': `${entry.eyes.wide.x * 100}%`,
    '--eye-y-md': `${entry.eyes.wide.y * 100}%`,
    '--eye-w-md': `${entry.eyes.wide.w * 100}%`,
  } as React.CSSProperties;

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full opacity-0 transition-opacity duration-700 ease-out data-[ready]:opacity-100 motion-reduce:hidden"
      />
      <div
        ref={eyesRef}
        aria-hidden="true"
        style={pos}
        className="pointer-events-none absolute left-[var(--eye-x)] top-[var(--eye-y)] w-[var(--eye-w)] opacity-0 mix-blend-screen motion-reduce:hidden md:left-[var(--eye-x-md)] md:top-[var(--eye-y-md)] md:w-[var(--eye-w-md)]"
      >
        {entry.eyesImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img data-lids src={entry.eyesImage} alt="" className="block w-full origin-center" />
        ) : (
          <DrawnEyes />
        )}
      </div>
    </>
  );
}

/** Stand-in panther eyes until a crop of the panther photograph is supplied (NightHeroEntry.eyesImage). */
function DrawnEyes() {
  const id = useId().replace(/:/g, '');
  const eyes = [50, 190];
  return (
    <svg viewBox="0 0 240 80" className="block h-auto w-full overflow-visible" style={{ filter: 'drop-shadow(0 0 10px #C9A64E55) drop-shadow(0 0 30px #C9A64E22)' }}>
      <defs>
        <radialGradient id={`${id}-iris`} cx="50%" cy="45%" r="55%">
          <stop offset="0" stopColor="#E9CF7A" />
          <stop offset=".45" stopColor="#C9A64E" />
          <stop offset=".85" stopColor="#6E7A30" />
          <stop offset="1" stopColor="#22250F" />
        </radialGradient>
        {eyes.map((cx) => (
          <clipPath key={cx} id={`${id}-c${cx}`}>
            <path d={`M${cx - 46} 40 Q${cx} -2 ${cx + 46} 40 Q${cx} 72 ${cx - 46} 40Z`} />
          </clipPath>
        ))}
      </defs>
      <g data-lids style={{ transformBox: 'fill-box', transformOrigin: '50% 50%' }}>
        {eyes.map((cx) => (
          <g key={cx} clipPath={`url(#${id}-c${cx})`}>
            <rect x={cx - 50} y={0} width={100} height={80} fill={`url(#${id}-iris)`} />
            <g data-pupil>
              <ellipse cx={cx} cy={40} rx={6} ry={26} fill="#030302" />
              <ellipse cx={cx + 10} cy={30} rx={4} ry={2.6} fill="#FFF6D8" opacity={0.7} />
            </g>
          </g>
        ))}
      </g>
    </svg>
  );
}
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors. If `React.CSSProperties` is flagged, import `type CSSProperties` from 'react' and use that.

- [ ] **Step 7: Commit**

```bash
git add src/lib/night-hero-shader.ts src/lib/night-hero-shader.test.ts src/components/shop/NightStage.tsx
git commit -m "feat(hero): night hero shader and Three.js stage"
```

---

### Task 4: `NightHero` section and home wiring

**Files:**
- Create: `src/components/shop/NightHero.tsx`
- Modify: `src/app/(shop)/page.tsx` (imports; lead render block around line 80; doc comment)

**Interfaces:**
- Consumes: `NightStage`, `nightHeroFor`, `NightHeroEntry`; existing `heroCta` (PresaleHero), `QuickReserveButton` (QuickBuyPanel), `quickBuyAction` (quick-buy), `formatPaise`, `PublicProduct`.
- Produces: `<NightHero product entry tagline? />`.

- [ ] **Step 1: Write `NightHero.tsx`**

```tsx
import Link from 'next/link';
import type { PublicProduct } from '@/lib/launches';
import { formatPaise } from '@/lib/money';
import type { NightHeroEntry } from '@/lib/night-hero';
import { NightStage } from './NightStage';
import { heroCta } from './PresaleHero';
import { QuickReserveButton } from './QuickBuyPanel';
import { quickBuyAction } from './quick-buy';

const ACTION =
  'mt-7 inline-flex h-12 select-none items-center border border-paper bg-paper px-7 font-sans text-label font-medium uppercase tracking-label text-ink transition-[background-color,color,transform] duration-fast ease-out hover:bg-transparent hover:text-paper focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[3px] focus-visible:outline-paper active:scale-[0.99] motion-reduce:transition-none';

/**
 * Home lead, "eyes in the dark" (docs/DESIGN.md): the real cloth, dark, with a panther's eyes; under the visitor's
 * light the real embroidery stitches itself in, then the room lights up. The poster (the lit, embroidered crop) is
 * the first paint and the whole hero under reduced motion; the copy and action are server-rendered and usable
 * from the first frame. A pre-order piece gets its reserve sheet in place, any other polo links to its page.
 */
export function NightHero({ product, entry, tagline }: { product: PublicProduct; entry: NightHeroEntry; tagline?: string }) {
  const colour = product.colours[0]!;
  const presale = product.launch.state === 'presale' && product.launch.presale;
  const href = `/products/${product.slug}`;
  const noun = /\bpolo\b/i.test(product.title) ? 'polo' : 'piece';
  const { wide, tall } = entry.crops;

  return (
    <section
      aria-labelledby="hero-title"
      data-chrome-hero
      className="relative isolate h-[min(88svh,52rem)] min-h-[34rem] overflow-hidden bg-ink text-paper md:h-[calc(100svh-6rem)] md:max-h-[68rem] md:min-h-[38rem]"
    >
      <picture>
        <source media="(min-width: 768px)" srcSet={wide.full} width={wide.w} height={wide.h} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={tall.full}
          width={tall.w}
          height={tall.h}
          alt={`${product.title}: the tonal embroidery on black piqué, close up`}
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </picture>
      <NightStage entry={entry} />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/60 via-35% to-transparent to-65% md:bg-gradient-to-r md:from-ink/80 md:via-ink/50 md:via-30% md:to-transparent md:to-55%"
      />
      <div className="container-page relative flex h-full flex-col justify-end pb-10 pt-header md:pb-14">
        <div className="max-w-[30rem]">
          {presale && <p className="care-tag">{product.launch.badge ?? 'Pre-order'}</p>}
          <h1 id="hero-title" className="mt-5 text-balance font-display text-[clamp(1.875rem,3.6vw,3.25rem)] font-light leading-[1.04] tracking-[-0.015em]">
            {entry.lines[0]} <span className="block">{entry.lines[1]}</span>
          </h1>
          {tagline && <p className="mt-4 text-small text-paper/75">{tagline}</p>}
          <p className="mt-4 text-small text-paper">
            <Link href={href} className="link-underline">
              {product.title}
            </Link>
          </p>
          <p className="mt-1 text-small tabular-nums text-paper/80">
            {colour.name}
            {!product.launch.priceHidden && (
              <>
                {' · '}
                {product.compareAtPrice && product.compareAtPrice > product.price && <s className="mr-2 text-paper/55">{formatPaise(product.compareAtPrice)}</s>}
                {formatPaise(product.price)}
              </>
            )}
          </p>
          {presale ? (
            <QuickReserveButton product={product} mode={quickBuyAction(product).mode} className={ACTION}>
              {heroCta(product)}
            </QuickReserveButton>
          ) : (
            <Link href={href} className={ACTION}>
              View the {noun}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Wire it into `page.tsx`**

Imports: add `import { NightHero } from '@/components/shop/NightHero';` and `import { nightHeroFor } from '@/lib/night-hero';`.

After `const stitchMotif = stitch && motifFor(stitch);` add:

```ts
  // A motif whose photographs have been prepared leads in the night hero; the others keep the drawn stitch hero.
  const night = nightHeroFor(stitchMotif || undefined);
```

Replace the lead render:

```tsx
          {stitch && stitchMotif ? (
            night ? (
              <NightHero product={stitch} entry={night} tagline={heroCopy?.heading} />
            ) : (
              <StitchHero product={stitch} motif={stitchMotif} headline={heroCopy?.heading} lede={heroCopy?.subheading} />
            )
          ) : (
```

Update the doc comment above `HomePage`: "the night hero (or, for a motif without prepared photographs, the stitch hero) leads …". `heroInStitch` stays unchanged: in the night hero the site-content heading becomes the tagline, so it still must not repeat below.

- [ ] **Step 3: Typecheck, test and build**

Run: `npm run typecheck && npm test && npm run build`
Expected: all green; the build lists `/` as dynamic.

- [ ] **Step 4: Check it in the browser.** Run `npm run dev` and open `/`. Check, at 1366 × 900 and at 390 × 844: the poster paints, then the canvas fades in dark; the eyes open; the rosettes stitch; it lights up; the copy is readable; the reserve sheet opens. Reload in the same tab and confirm it starts lit with no eyes. With reduced motion emulated, only the poster shows. Take screenshots of the mid-stitch and end frames.

- [ ] **Step 5: Commit**

```bash
git add src/components/shop/NightHero.tsx "src/app/(shop)/page.tsx"
git commit -m "feat(hero): night hero leads the home page for the panther polo"
```

---

### Task 5: Docs

**Files:**
- Modify: `docs/DESIGN.md` (add a "Home hero: eyes in the dark" section before "Home hero: \"the stitch\""; mention the dark header state)
- Modify: `docs/DECISIONS.md` (add D15 under D14)
- Modify: `docs/superpowers/specs/2026-10-19-night-hero-design.md` (tall crop is 1280 × 1600; the site heading is shown as the tagline; the poster-to-dark fade is intended)

- [ ] **Step 1: DESIGN.md section**

```markdown
## Home hero: "eyes in the dark"
A motif with prepared photographs leads the home page in the night hero (`shop/NightHero`, `shop/NightStage`, pure parts in `lib/night-hero.ts`, spec in `docs/superpowers/specs/2026-10-19-night-hero-design.md`). Today that is the Panther Polo; the other motifs keep the stitch hero below until their photographs are prepared with `scripts/prep-night-hero.mjs`.
- **The cloth is a photograph.** A Three.js shader puts the real thread back into a bare-cloth copy of the real macro photo, rosette by rosette, under a soft torch that follows the pointer. Nothing on the cloth is drawn.
- **Sequence (11 s, 8 s on phones).** Dark cloth and a panther's eyes, the torch comes on, the rosettes stitch from the collar down, the eyes blink and close, and the room lights up. Afterwards the torch keeps following the pointer as a raking light. It plays once per session, and later visits start lit.
- **The copy does not wait.** The h1, the price and the reserve action are server-rendered and visible from the first frame, on an ink scrim (left on desktop, bottom on phones). The header uses the dark-hero state (`data-chrome-hero`, paper type).
- **Fallbacks.** The poster (the lit embroidered crop) is the first paint. It is the whole hero under reduced motion, without WebGL, or if the textures fail to load. Three.js and anime.js load only here, after mount.
- **Eyes.** The drawn eyes are a stand-in. A crop of the panther photograph on black goes in `NightHeroEntry.eyesImage`.
```

- [ ] **Step 2: DECISIONS.md row (append after D14)**

```markdown
| D15 | Home hero for the panther | Real macro photograph + Three.js shader ("eyes in the dark"); drawn stitch hero kept for motifs without prepared photographs | The drawn polo did not read as real fabric; a black panther's hidden rosettes are the polo's tonal embroidery | Real photographs prepared for the other motifs, or a blank-polo shoot for an exact bare cloth |
```

- [ ] **Step 3: Update the spec** (the three points above), then run `npm run typecheck && npm test`.

- [ ] **Step 4: Commit**

```bash
git add docs/DESIGN.md docs/DECISIONS.md docs/superpowers/specs/2026-10-19-night-hero-design.md
git commit -m "docs: night hero in DESIGN and DECISIONS"
```
