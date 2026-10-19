// The night hero's full-screen shader (docs/superpowers/specs/2026-10-19-night-hero-design.md).
// Cloth: the bare cloth becomes the embroidered photograph as uProg passes each thread pixel's time in the order
// map (satin stitch by satin stitch, from scripts/prep-night-hero.mjs). Sewn thread gets relief from the
// photograph's own height (embroidered minus bare), lit from the torch's direction, and a moment of fresh shine.
// Eyes: a panther's pair, drawn here so they share the scene's light: fibred iris, limbal ring, lid shadow,
// a wet cornea highlight toward the torch, pupils that close to slits as the light reaches them and glow back
// (eyeshine) when it does.

export const UNIFORMS = [
  'uBare', 'uFull', 'uOrder', 'uRes', 'uLight', 'uCover', 'uTexel',
  'uProg', 'uAmb', 'uTorch', 'uRad', 'uSeed',
  'uEyeC', 'uEyeS', 'uEye', 'uLid', 'uLook', 'uDil', 'uLit',
] as const;

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
uniform vec2 uTexel;
uniform float uProg;
uniform float uAmb;
uniform float uTorch;
uniform float uRad;
uniform float uSeed;
uniform vec2 uEyeC;
uniform float uEyeS;
uniform float uEye;
uniform float uLid;
uniform vec2 uLook;
uniform float uDil;
uniform float uLit;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float lift(vec2 uv) { return max(0.0, lum(texture2D(uFull, uv).rgb) - lum(texture2D(uBare, uv).rgb)); }

// One eye. q: eye space, x -1..1 across the opening, y up, in eye half-widths. side: -1 left, 1 right.
vec4 eye(vec2 q, float side, vec2 toLight) {
  q.x *= side;                 // mirror: the outer corner is +x
  q.y -= q.x * 0.12;           // the slant, outer corner up
  // A cat's opening is rounder than a person's: pointed at the inner corner, full at the outer one.
  float ax = max(1.0 - q.x * q.x, 0.0);
  float e = mix(0.72, 0.42, smoothstep(-1.0, 1.0, q.x));
  float top = uLid * 0.66 * pow(ax, e) + (1.0 - uLid) * 0.015;
  float bot = -uLid * 0.56 * pow(ax, e + 0.12);
  float dTop = top - q.y, dBot = q.y - bot;
  float open = smoothstep(0.0, 0.03, dTop) * smoothstep(0.0, 0.03, dBot);

  // The eyeball is round and sits under the lids: darker toward the corners and where the lids overhang it.
  float ao = mix(0.3, 1.0, smoothstep(0.0, 0.24, min(dTop, dBot))) * (1.0 - 0.4 * q.x * q.x);
  ao *= 1.0 - 0.5 * smoothstep(0.3, 0.0, dTop);

  vec2 ic = q - vec2(uLook.x * side * 0.18, uLook.y * 0.06);
  float r = length(ic) / 0.88;
  float a = atan(ic.y, ic.x);
  vec2 pr = vec2(mix(0.05, 0.44, uDil), mix(0.7, 0.56, uDil));
  float pd = length(ic / pr);
  float pupil = 1.0 - smoothstep(0.9, 1.04, pd);

  // Iris: fine fibres bent by a slow warp, mottled in patches, amber at the pupil, gold, then olive at the rim.
  float warp = fbm(vec2(a * 4.0, r * 2.5) + side * 7.0);
  float fibres = fbm(vec2(a * 38.0 + warp * 4.0, r * 5.0));
  float mottle = fbm(ic * 4.5 + side * 11.0) - 0.5;
  vec3 iris = mix(vec3(0.56, 0.38, 0.11), vec3(0.64, 0.56, 0.22), smoothstep(0.25, 0.62, r + mottle * 0.3));
  iris = mix(iris, vec3(0.40, 0.43, 0.17), smoothstep(0.62, 0.96, r + mottle * 0.2));
  iris *= 0.68 + 0.6 * fibres + 0.3 * mottle;
  iris *= 1.0 - 0.85 * smoothstep(0.86, 1.02, r);               // limbal ring
  iris *= 1.0 - 0.45 * exp(-pow((pd - 1.1) * 5.0, 2.0));          // the dark edge hugging the pupil
  vec3 col = iris * (0.2 + 0.8 * uLit) * ao;

  // Pupil: deep black. The tapetum glows back only while the pupil is still open to the light.
  float shine = uLit * smoothstep(0.12, 0.7, uDil);
  vec3 tapetum = mix(vec3(0.3, 0.5, 0.16), vec3(0.8, 0.78, 0.36), smoothstep(1.0, 0.0, pd)) * (0.75 + 0.25 * fbm(ic * 12.0));
  col = mix(col, vec3(0.005) + tapetum * shine * 1.4, pupil);

  // Wet cornea: a sharp highlight on the torch's side, a soft window reflection, and a wet line on the lower lid.
  vec2 sp = vec2(toLight.x * side, toLight.y) * 0.3 + vec2(0.0, 0.2);
  col += vec3(1.0, 0.98, 0.92) * exp(-dot(q - sp, q - sp) / 0.0022) * (0.25 + 1.1 * uLit) * ao;
  vec2 wq = (q - sp * 0.6 - vec2(-0.14, 0.04)) / vec2(0.32, 0.17);
  col += vec3(0.05, 0.055, 0.06) * smoothstep(1.0, 0.0, length(wq)) * (0.3 + uLit);
  col += vec3(0.14) * exp(-pow((dBot - 0.025) / 0.012, 2.0)) * ax * (0.2 + uLit);
  // The black skin rim round the opening (a cat's 'eyeliner'), so the eye sits in a face, not on the cloth.
  float rim = smoothstep(0.16, 0.0, -min(dTop, dBot)) * (1.0 - smoothstep(1.0, 1.2, abs(q.x))) * (1.0 - open);
  float alpha = max(open, rim * 0.92);
  return vec4(col * open / max(alpha, 0.001), alpha);
}

void main() {
  vec2 uv = (vUv - 0.5) * uCover + 0.5;
  vec3 bare = texture2D(uBare, uv).rgb;
  vec3 full = texture2D(uFull, uv).rgb;
  vec4 o = texture2D(uOrder, uv);
  float t = (o.r * 65280.0 + o.g * 255.0) / 65535.0;
  float thread = step(0.5, o.b);
  float age = uProg - t;
  float sewn = thread * smoothstep(0.0, 0.0004, age);
  vec3 col = mix(bare, full, sewn);

  float sa = uRes.x / uRes.y;
  vec2 p = (vUv - uLight) * vec2(sa, 1.0);
  float d2 = dot(p, p);
  float torch = uTorch * exp(-d2 / (uRad * uRad));
  float rake = uTorch * exp(-d2 / (uRad * uRad * 5.0));
  col *= uAmb + torch * 2.1 + rake * 0.35;

  // Relief: raised thread catches the torch on its near side and falls into shadow on the far one.
  vec2 g = vec2(lift(uv + vec2(uTexel.x, 0.0)) - lift(uv - vec2(uTexel.x, 0.0)), lift(uv + vec2(0.0, uTexel.y)) - lift(uv - vec2(0.0, uTexel.y)));
  vec3 n = normalize(vec3(-g * 7.0, 1.0));
  vec3 l = normalize(vec3(-p, 0.22));
  float diffuse = max(dot(n, l), 0.0);
  col *= mix(1.0, 0.45 + 1.0 * diffuse, sewn * clamp(torch + rake * 0.6, 0.0, 1.0));
  // Freshly laid thread is pulled tight and shines, then settles; the newest stitch glints where the needle is.
  // (age is clamped: unsewn pixels have age < 0, and exp of a large positive number overflows to NaN here.)
  float done = step(uProg, 0.999), settled = max(age, 0.0);
  col += sewn * exp(-settled / 0.006) * done * vec3(0.10, 0.095, 0.085) * (0.4 + torch * 1.4);
  col += sewn * exp(-settled / 0.0012) * done * vec3(0.92, 0.88, 0.8) * (0.14 + torch * 0.6);

  col *= mix(0.45, 1.0, smoothstep(1.25, 0.25, length((vUv - 0.5) * vec2(1.5, 1.0))));

  if (uEye > 0.001) {
    vec2 e = (vUv - uEyeC) * vec2(sa, 1.0) / uEyeS;
    vec2 toLight = normalize((uLight - uEyeC) * vec2(sa, 1.0) + vec2(0.0001));
    // The face sits in shadow, so the eyes come out of the dark rather than float on the cloth.
    float face = exp(-dot(e * vec2(0.26, 0.5), e * vec2(0.26, 0.5)));
    float sockets = exp(-pow(length(vec2(abs(e.x) - 1.6, e.y * 1.5)) / 1.25, 2.0));
    col *= 1.0 - (0.6 * face + 0.35 * sockets) * uEye;
    vec4 le = eye(vec2(e.x + 1.6, e.y), -1.0, toLight);
    vec4 re = eye(vec2(e.x - 1.6, e.y), 1.0, toLight);
    col = mix(col, le.rgb, le.a * uEye);
    col = mix(col, re.rgb, re.a * uEye);
    // A faint glow off the eyeshine.
    float glow = exp(-dot(vec2(abs(e.x) - 1.6, e.y), vec2(abs(e.x) - 1.6, e.y)) / 1.6);
    col += vec3(0.5, 0.42, 0.16) * glow * uEye * (0.03 + 0.1 * uLit);
  }

  col += (hash(vUv * uRes + uSeed) - 0.5) * 0.018;
  gl_FragColor = vec4(col, 1.0);
}`;
