import { describe, expect, it } from 'vitest';
import { FRAGMENT, UNIFORMS, VERTEX } from './night-hero-shader';

describe('night hero shader', () => {
  it('declares every uniform the stage sets', () => {
    for (const u of UNIFORMS) expect(FRAGMENT).toMatch(new RegExp(`\\b${u}\\b`));
  });
  it('decodes the order map as the prep script encodes it', () => {
    expect(FRAGMENT).toContain('(o.r * 65280.0 + o.g * 255.0) / 65535.0');
  });
  it('reveals at stitch scale, sharper than one satin stitch', () => {
    // A rosette takes 0.075 of the run over at least 12 stitches; the reveal edge must be narrower than one.
    const edge = Number(/smoothstep\(0\.0, ([\d.]+), age\)/.exec(FRAGMENT)?.[1]);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(0.075 / 12);
  });
  it('passes uv through the vertex stage', () => {
    expect(VERTEX).toContain('vUv = uv');
  });
});
