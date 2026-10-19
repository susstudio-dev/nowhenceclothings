import { describe, expect, it } from 'vitest';
import { NIGHT_DARK, NIGHT_LIT, NIGHT_MS, coverScale, decodeOrder, driftAt, encodeOrder, eyeLight, imageToStage, needleAt, nightHeroFor, timelineFor, type Needle } from './night-hero';

describe('nightHeroFor', () => {
  it('has prepared photographs for the panther only', () => {
    const e = nightHeroFor('rings')!;
    expect(e.crops.wide).toMatchObject({ full: '/hero/rings/wide/full.webp', bare: '/hero/rings/wide/bare.webp', order: '/hero/rings/wide/order.png', w: 1600, h: 900 });
    expect(e.crops.tall.w / e.crops.tall.h).toBeCloseTo(0.8);
    expect(e.lines).toHaveLength(2);
    for (const m of ['wing', 'rain', 'pebbles', 'diamonds'] as const) expect(nightHeroFor(m)).toBeUndefined();
    expect(nightHeroFor(undefined)).toBeUndefined();
  });
  it('places the pair of eyes inside the stage', () => {
    const { wide, tall } = nightHeroFor('rings')!.eyes;
    // The pair spans about ±2.6 eye half-widths from its centre (shader: eyes at ±1.6, each 1 wide).
    for (const [p, aspect] of [[wide, 1366 / 804], [tall, 390 / 742]] as const) {
      const half = (2.6 * p.size) / aspect;
      expect(p.x - half).toBeGreaterThan(0);
      expect(p.x + half).toBeLessThan(1);
      expect(p.y - p.size).toBeGreaterThan(0);
      expect(p.y + p.size).toBeLessThan(0.5);
    }
  });
});

describe('eyeLight', () => {
  const eyes = { x: 0.7, y: 0.35, size: 0.05 };
  it('is full when the torch is on the eyes and fades with distance', () => {
    expect(eyeLight(1, 0.17, [0.7, 0.35], eyes, 1.7)).toBeCloseTo(1);
    const near = eyeLight(1, 0.17, [0.6, 0.35], eyes, 1.7), far = eyeLight(1, 0.17, [0.2, 0.8], eyes, 1.7);
    expect(near).toBeLessThan(1);
    expect(far).toBeLessThan(near);
    expect(far).toBeLessThan(0.01);
  });
  it('is dark with the torch off', () => {
    expect(eyeLight(0, 0.17, [0.7, 0.35], eyes, 1.7)).toBe(0);
  });
});

describe('needleAt', () => {
  const needle: Needle = { dur: 0.1, rosettes: [[0.9, 0.1, 0], [0.5, 0.5, 0.45], [0.1, 0.9, 0.9]] };
  it('starts on the first rosette and ends on the last', () => {
    expect(needleAt(0, needle)).toEqual([0.9, 0.1]);
    expect(needleAt(1, needle)).toEqual([0.1, 0.9]);
  });
  it('glides between rosettes, halfway at the midpoint of their middles', () => {
    const [x, y] = needleAt((0.05 + 0.5) / 2, needle);
    expect(x).toBeCloseTo(0.7);
    expect(y).toBeCloseTo(0.3);
  });
  it('never jumps: a small step in time is a small step on the cloth', () => {
    for (let p = 0; p < 1; p += 0.001) {
      const [a, b] = needleAt(p, needle), [c, d] = needleAt(p + 0.001, needle);
      expect(Math.hypot(c - a, d - b)).toBeLessThan(0.01);
    }
  });
  it('follows every prepared route from the first rosette', () => {
    for (const c of Object.values(nightHeroFor('rings')!.crops)) {
      expect(c.needle.rosettes.length).toBeGreaterThan(10);
      expect(needleAt(0, c.needle)).toEqual([c.needle.rosettes[0]![0], c.needle.rosettes[0]![1]]);
      const starts = c.needle.rosettes.map((r) => r[2]!);
      expect(starts).toEqual([...starts].sort((a, b) => a - b));
    }
  });
});

describe('imageToStage', () => {
  it('is the identity when the image fits the stage', () => {
    expect(imageToStage([0.3, 0.7], [1, 1])).toEqual([0.3, 0.7]);
  });
  it('spreads the visible band of a cropped image across the stage', () => {
    // A stage half as tall as the image shows its middle half: y 0.25–0.75 maps to 0–1.
    expect(imageToStage([0.5, 0.25], [1, 0.5])).toEqual([0.5, 0]);
    expect(imageToStage([0.5, 0.75], [1, 0.5])).toEqual([0.5, 1]);
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
