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
