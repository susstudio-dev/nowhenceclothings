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
