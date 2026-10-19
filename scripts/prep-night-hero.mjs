// Prepares the home night hero's textures from a macro photograph (docs/superpowers/specs/2026-10-19-night-hero-design.md).
// Run by hand; its output is committed. Usage: node scripts/prep-night-hero.mjs <source image> <motif>
// Per crop: full.webp (the photograph), bare.webp (the thread replaced by nearby piqué) and order.png
// (R,G = 16-bit time each thread pixel is sewn, B = thread), plus src/lib/night-hero-data/<motif>-<crop>.json (the
// needle's route). Must stay in step with decodeOrder in src/lib/night-hero.ts.
import { mkdir, writeFile } from 'node:fs/promises';
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

async function prep(name, box, out) {
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

  // Stitch order, as a machine sews satin stitch: rosettes go one after another (a few overlapping) from the collar
  // (top right) down. Round each ring, from a random start, the needle lays one stitch every SPACING px; each stitch
  // crosses the band of thread, inner edge to outer edge, and the next comes back (a zigzag). A pixel's time is when
  // the needle passes it.
  const ros = keep.map((p) => {
    let sx = 0, sy = 0;
    for (const i of p) { sx += i % W; sy += (i / W) | 0; }
    return { p, cx: sx / p.length, cy: sy / p.length };
  });
  // The needle's route: start at the rosette nearest the collar (top right), then always go to the nearest one
  // not yet sewn (a little bias downward), so the path, and the light that follows it, travels smoothly.
  const route = [];
  const left = new Set(ros.keys());
  let at = ros.reduce((b, r, n) => (r.cy - r.cx < ros[b].cy - ros[b].cx ? n : b), 0);
  while (left.size) {
    left.delete(at); route.push(ros[at]);
    let next = -1, best = Infinity;
    for (const n of left) {
      const d = Math.hypot(ros[n].cx - ros[at].cx, (ros[n].cy - ros[at].cy) * (ros[n].cy < ros[at].cy ? 1.6 : 1));
      if (d < best) { best = d; next = n; }
    }
    at = next;
  }
  ros.splice(0, ros.length, ...route);
  const rand = rng(3), dur = 0.075, span = 1 - dur, BINS = 72, SPACING = 4.5;
  const lab = new Int32Array(N);
  ros.forEach((r, k) => {
    r.t0 = (span * k) / Math.max(1, ros.length - 1);
    r.a0 = rand() * 2 * Math.PI;
    for (const i of r.p) lab[i] = k + 1;
  });
  const labD = dilate(lab, W, H, 3);
  const TAU = 2 * Math.PI;
  for (const r of ros) r.px = [];
  for (let i = 0; i < N; i++) if (threadD[i] && labD[i]) ros[labD[i] - 1].px.push(i);

  // Each rosette gets, per pixel, how far along the needle's path it is (f, 0–1) and where it sits across the band
  // (d). A ring or C-shape is followed round its centre; a solid blob or a short arc is followed end to end
  // (geodesic distance from its far end), with the band measured across its main axis.
  for (const r of ros) {
    const k = labD[Math.round(r.cy) * W + Math.round(r.cx)];
    const bins = new Uint8Array(BINS);
    const ang = r.px.map((i) => {
      const f = ((((Math.atan2(((i / W) | 0) - r.cy, (i % W) - r.cx) - r.a0) % TAU) + TAU) % TAU) / TAU;
      bins[Math.min(BINS - 1, (f * BINS) | 0)] = 1;
      return f;
    });
    const cover = bins.reduce((a, v) => a + v, 0) / BINS;
    if (k !== labD[r.px[0]] && cover >= 0.5) {
      r.f = ang;
      r.d = r.px.map((i) => Math.hypot((i % W) - r.cx, ((i / W) | 0) - r.cy));
      r.length = TAU * (r.d.reduce((a, v) => a + v, 0) / r.d.length);
      continue;
    }
    const index = new Map(r.px.map((i, n) => [i, n]));
    let far = 0, best = -1;
    r.px.forEach((i, n) => { const d = Math.hypot((i % W) - r.cx, ((i / W) | 0) - r.cy); if (d > best) { best = d; far = n; } });
    const dist = new Float32Array(r.px.length).fill(-1);
    const queue = [far]; dist[far] = 0;
    for (let h = 0; h < queue.length; h++) {
      const i = r.px[queue[h]], x = i % W, y = (i / W) | 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const n = index.get((y + dy) * W + x + dx);
          if (n !== undefined && dist[n] < 0) { dist[n] = dist[queue[h]] + Math.hypot(dx, dy); queue.push(n); }
        }
    }
    const max = Math.max(1, ...dist);
    // Main axis by PCA; the band is measured along its perpendicular.
    let sxx = 0, syy = 0, sxy = 0;
    for (const i of r.px) { const x = (i % W) - r.cx, y = ((i / W) | 0) - r.cy; sxx += x * x; syy += y * y; sxy += x * y; }
    const th = 0.5 * Math.atan2(2 * sxy, sxx - syy), nx = -Math.sin(th), ny = Math.cos(th);
    r.f = Array.from(dist, (v) => (v < 0 ? 1 : v / max));
    r.d = r.px.map((i) => ((i % W) - r.cx) * nx + (((i / W) | 0) - r.cy) * ny);
    r.length = max;
  }

  const order = Buffer.alloc(N * 3);
  for (const r of ros) {
    const rin = new Float32Array(BINS).fill(Infinity), rout = new Float32Array(BINS).fill(-Infinity);
    const bin = r.f.map((f) => Math.min(BINS - 1, (f * BINS) | 0));
    r.d.forEach((d, n) => { if (d < rin[bin[n]]) rin[bin[n]] = d; if (d > rout[bin[n]]) rout[bin[n]] = d; });
    const stitches = Math.max(12, Math.round(r.length / SPACING));
    r.px.forEach((i, n) => {
      const b = bin[n], u = Math.min(1, Math.max(0, (r.d[n] - rin[b]) / Math.max(1, rout[b] - rin[b])));
      const s = Math.min(stitches - 1, Math.floor(r.f[n] * stitches));
      const across = s % 2 ? 1 - u : u;
      const q = Math.max(1, Math.min(65535, Math.round((r.t0 + (dur * (s + across)) / stitches) * 65535)));
      order[3 * i] = q >> 8; order[3 * i + 1] = q & 255; order[3 * i + 2] = 255;
    });
  }

  await mkdir(out, { recursive: true });
  // The route for the light that follows the needle: each rosette's centre (fractions of the crop) and start time.
  const needle = { dur, rosettes: ros.map((r) => [+(r.cx / W).toFixed(4), +(r.cy / H).toFixed(4), +r.t0.toFixed(4)]) };
  await mkdir(dataDir, { recursive: true });
  await writeFile(`${dataDir}/${motif}-${name}.json`, JSON.stringify(needle) + '\n');
  const rawOpts = { raw: { width: W, height: H, channels: 3 } };
  await sharp(rgb, rawOpts).webp({ quality: 86 }).toFile(`${out}/full.webp`);
  await sharp(Buffer.from(bare), rawOpts).webp({ quality: 86 }).toFile(`${out}/bare.webp`);
  await sharp(order, rawOpts).png({ compressionLevel: 9 }).toFile(`${out}/order.png`);
  console.log(out, `${W}×${H}`, `${ros.length} rosettes`);
}

const dataDir = 'src/lib/night-hero-data';
for (const [name, box] of Object.entries(CROPS)) await prep(name, box, `public/hero/${motif}/${name}`);
