import { describe, expect, it } from 'vitest';
import {
  BODY,
  FULL,
  MOTIFS,
  PIECES,
  TIMELINE,
  buildScene,
  camera,
  cumul,
  frame,
  mirrorD,
  motifFor,
  pickStitchProduct,
  pieceFrame,
  pointAt,
  resample,
  sampleD,
  sceneMarkup,
  seamPath,
  stitchPalette,
  zigzag,
  type Motif,
  type Pt,
} from './stitch-hero';

const ALL: Motif[] = ['rings', 'wing', 'rain', 'pebbles', 'diamonds'];
const HEX = /^#[0-9A-F]{6}$/;

describe('motifFor', () => {
  it('reads the motif from the slug or the title', () => {
    expect(motifFor({ slug: 'polo-black-ring-embroidered', title: 'x' })).toBe('rings');
    expect(motifFor({ slug: 'polo-rust-wing-sleeve', title: 'x' })).toBe('wing');
    expect(motifFor({ slug: 'polo-navy-rain-emboss', title: 'x' })).toBe('rain');
    expect(motifFor({ slug: 'polo-olive-pebble-hem', title: 'x' })).toBe('pebbles');
    expect(motifFor({ slug: 'x', title: 'Diamond Back Polo' })).toBe('diamonds');
  });
  it('matches whole words only', () => {
    expect(motifFor({ slug: 'spring-shirt', title: 'Drawstring Trouser' })).toBeUndefined();
    expect(motifFor({ slug: 'heavyweight-tee', title: 'Heavyweight Tee' })).toBeUndefined();
    expect(motifFor({ slug: 'terrain-jacket', title: 'Terrain Jacket' })).toBeUndefined();
  });
});

describe('pickStitchProduct', () => {
  const tee = { slug: 'heavyweight-tee', title: 'Heavyweight Tee' };
  const ring = { slug: 'polo-black-ring-embroidered', title: 'Ring Embroidered Polo' };
  const wing = { slug: 'polo-rust-wing-sleeve', title: 'Wing Sleeve Polo' };
  it('lets an open pre-order lead only when it has a motif', () => {
    expect(pickStitchProduct(wing, [ring])).toBe(wing);
    expect(pickStitchProduct(tee, [ring])).toBeUndefined();
  });
  it('otherwise takes the first product with a motif', () => {
    expect(pickStitchProduct(undefined, [tee, ring, wing])).toBe(ring);
    expect(pickStitchProduct(undefined, [tee])).toBeUndefined();
  });
});

describe('stitchPalette', () => {
  it('keeps the thread tonal: lighter than dark cloth, darker than light cloth', () => {
    const dark = stitchPalette('#141412', 'rings');
    const light = stitchPalette('#E9E1CF', 'diamonds');
    for (const p of [dark, light]) for (const k of ['cloth', 'hi', 'lo', 'thread', 'threadHi', 'shadow', 'seam'] as const) expect(p[k]).toMatch(HEX);
    const v = (h: string) => parseInt(h.slice(1, 3), 16);
    expect(v(dark.thread)).toBeGreaterThan(v(dark.cloth));
    expect(v(light.thread)).toBeLessThan(v(light.cloth));
    expect(dark.bg).toBe('#A2A3A1');
  });
  it('falls back to black on a malformed hex', () => {
    expect(stitchPalette('nope', 'rain').cloth).toBe('#141412');
  });
});

describe('geometry', () => {
  it('samples straight and curved paths, closing on Z', () => {
    const line = sampleD('M0 0 L10 0');
    expect(line).toEqual([[0, 0], [10, 0]]);
    const curve = sampleD('M0 0 C0 10 10 10 10 0');
    expect(curve).toHaveLength(25);
    expect(curve[24]).toEqual([10, 0]);
    const body = sampleD(BODY);
    expect(body[body.length - 1]).toEqual(body[0]);
  });
  it('resamples at an even step and finds points by length', () => {
    const pts = resample([[0, 0], [10, 0]], 1);
    expect(pts).toHaveLength(12); // 0…10 plus the kept end
    const cum = cumul(pts);
    expect(cum[cum.length - 1]).toBeCloseTo(10);
    expect(pointAt(pts, cum, 0.5).x).toBeCloseTo(5);
  });
  it('satin stitch crosses the line from side to side', () => {
    const z = zigzag([[0, 0], [20, 0]], 2);
    expect(z.length).toBeGreaterThan(20);
    z.forEach((p, i) => expect(p[1]).toBeCloseTo(i % 2 ? 1 : -1));
  });
  it('mirrors across the centre line', () => {
    expect(mirrorD('M238 98 L156 126')).toBe('M362 98 L444 126');
  });
});

describe('motifs', () => {
  it.each(ALL)('%s is deterministic and stays on the garment', (m) => {
    const a = MOTIFS[m]();
    expect(a.length).toBeGreaterThan(20);
    expect(JSON.stringify(MOTIFS[m]())).toBe(JSON.stringify(a));
    const pts: Pt[] = a.flatMap((r) => (r.kind === 'dot' ? [[r.cx, r.cy] as Pt] : r.pts));
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThan(140);
      expect(x).toBeLessThan(560);
      expect(y).toBeGreaterThan(120);
      expect(y).toBeLessThan(640);
    }
  });
});

describe('buildScene', () => {
  it.each(ALL)('%s schedules every stitch inside the embroidery window, in order', (m) => {
    const s = buildScene(m);
    const [a, b] = TIMELINE.emb;
    let prev = 0;
    for (const e of s.els) {
      expect(e.s).toBeGreaterThanOrEqual(a);
      expect(e.e).toBeLessThanOrEqual(b + 1e-9);
      expect(e.e).toBeGreaterThan(e.s);
      expect(e.s).toBeGreaterThanOrEqual(prev);
      prev = e.s;
    }
    expect(s.follow).toHaveLength(s.els.length);
  });
  it('sews the seams in pairs inside the seam window', () => {
    const s = buildScene('rings');
    expect(s.seams.length).toBe(15);
    for (const seam of s.seams) {
      expect(seam.s).toBeGreaterThanOrEqual(TIMELINE.seams[0]);
      expect(seam.e).toBeLessThanOrEqual(TIMELINE.seams[1] + 1e-9);
    }
    expect(s.seams[0]!.s).toBe(s.seams[1]!.s); // left and right shoulders together
  });
  it('puts the wing on the sleeve', () => {
    expect(buildScene('wing').host).toBe('sleeveR');
    expect(buildScene('rain').host).toBe('body');
  });
});

describe('camera and frames', () => {
  const scene = buildScene('rings');
  it('opens close on the first stitches and ends on the whole polo', () => {
    const start = camera(scene, 0, false);
    expect(start.w).toBeCloseTo(150);
    expect(camera(scene, 0, true).w).toBeCloseTo(120);
    expect(start.cx).toBeCloseTo(scene.follow[0]![0]);
    const end = camera(scene, 1, false);
    expect(end.w).toBeCloseTo(FULL.w);
    expect(end.cx).toBeCloseTo(FULL.cx);
  });
  it('keeps the host piece home and brings the others in', () => {
    const body = PIECES.find((p) => p.id === 'body')!;
    const collar = PIECES.find((p) => p.id === 'collar')!;
    expect(pieceFrame(body, 0, 'body')).toMatchObject({ transform: '', opacity: 1 });
    expect(pieceFrame(collar, 0, 'body').opacity).toBe(0);
    expect(pieceFrame(collar, 1, 'body')).toMatchObject({ transform: '', opacity: 1 });
    expect(pieceFrame(body, 0, 'sleeveR').transform).not.toBe('');
  });
  it('is blank at the start and finished at the end', () => {
    const f0 = frame(scene, 0, false);
    expect(f0.els.every((p) => p === 0)).toBe(true);
    expect(f0.seams.every((p) => p === 0)).toBe(true);
    const f1 = frame(scene, 1, false);
    expect(f1.els.every((p) => p === 1)).toBe(true);
    expect(f1.seams.every((p) => p === 1)).toBe(true);
    expect(f1.buttons).toEqual([1, 1]);
    expect(f1.tips).toHaveLength(0);
    expect(f1.draftOpacity).toBe(0);
    expect(f1.viewBox).toBe('10 29.7 580 676.7');
  });
  it('widens the frame to fill a wide stage, keeping the camera centre', () => {
    expect(frame(scene, 1, false, 2).viewBox).toBe('-376.7 29.7 1353.3 676.7');
    expect(frame(scene, 1, false, 0.5).viewBox).toBe('10 -212 580 1160');
  });
  it('shows a needle while stitching', () => {
    const mid = frame(scene, 0.2, false);
    expect(mid.tips.length).toBeGreaterThan(0);
    expect(mid.tips[0]!.s).toBeGreaterThanOrEqual(mid.tips[mid.tips.length - 1]!.s);
  });
  it('draws a seam up to the needle', () => {
    const seam = scene.seams[0]!;
    expect(seamPath(seam, 0)).toBe('');
    expect(seamPath(seam, 1)).toMatch(/^M238 98L/);
  });
});

describe('sceneMarkup', () => {
  it('carries one group per stitch, seam, button and both needles, with the motif on its host', () => {
    const scene = buildScene('wing');
    const svg = sceneMarkup(scene);
    expect(svg.match(/id="nhs-e\d+"/g)).toHaveLength(scene.els.length);
    expect(svg.match(/id="nhs-s\d+"/g)).toHaveLength(scene.seams.length);
    expect(svg).toContain('id="nhs-bt1"');
    expect(svg).toContain('id="nhs-nd1"');
    const sleeve = svg.slice(svg.indexOf('id="nhs-pc-sleeveR"'), svg.indexOf('id="nhs-pc-cuffL"'));
    expect(sleeve).toContain('id="nhs-e0"');
    expect(svg).not.toMatch(/undefined|NaN/);
  });
});
