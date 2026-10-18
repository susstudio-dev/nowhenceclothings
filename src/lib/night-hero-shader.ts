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
