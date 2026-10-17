#!/usr/bin/env node
// Generates the bundled favicon / app-icon / social-card set from the owner's
// symbol (assets/brand/logo/symbol_black_svg.svg) into public/brand-default/.
//
//   node scripts/generate-brand-icons.mjs
//
// Outputs (all committed; rerun only when the brand mark or palette changes):
//   icon.svg                 tab icon, transparent, adapts to dark browser chrome
//   favicon.ico              16/32/48 (PNG-encoded entries)
//   icon-32.png icon-48.png  <link rel="icon"> PNGs (48 = Google's multiple-of-48 rule)
//   icon-180.png             apple-touch-icon (symbol with generous padding)
//   icon-192.png icon-512.png            manifest "any" icons
//   icon-maskable-512.png    manifest "maskable": ring inside the 80% safe zone
//   og-default.jpg           1200x630 Open Graph / Twitter card
// plus src/lib/brand-icon-data.ts (base64 of favicon.ico, served by /favicon.ico
// without a redirect). Uses sharp (already installed via next).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'brand-default');
const INK = '#0b0b0b';
const PAPER = '#f4f4f2';

// The symbol is drawn on a 240 canvas; the ring itself spans 80..160.
const symbolSrc = readFileSync(join(root, 'assets/brand/logo/symbol_black_svg.svg'), 'utf8');
const inner = symbolSrc.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const RING = 80;
const CENTRE = 120;

/** Square icon: symbol centred, ring diameter = ringFrac of the side. */
function iconSvg(size, ringFrac, bg, fg) {
  const k = (ringFrac * size) / RING;
  const t = size / 2 - CENTRE * k;
  const body = inner.replace(/fill="black"/g, `fill="${fg}"`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${
    bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : ''
  }<g transform="translate(${t} ${t}) scale(${k})">${body}</g></svg>`;
}

async function png(size, ringFrac) {
  // Render large then downsample: crisper than rasterising at 16px directly.
  const big = Math.max(size * 4, 512);
  return sharp(Buffer.from(iconSvg(big, ringFrac, PAPER, INK)))
    .resize(size, size, { kernel: 'lanczos3' })
    .flatten({ background: PAPER })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** Minimal ICO container with PNG payloads (supported since Windows Vista and every browser). */
function ico(entries) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(entries.length, 4);
  let offset = 6 + 16 * entries.length;
  const dir = entries.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([head, ...dir, ...entries.map((e) => e.data)]);
}

const w = (name, data) => {
  writeFileSync(join(out, name), data);
  console.log('wrote', name, data.length, 'bytes');
};

// ---- tab icon (SVG, adapts to the browser's colour scheme) -----------------
const tight = (RING / 2) * 1.1; // ring plus 10% breathing room
const vb = `${CENTRE - tight} ${CENTRE - tight} ${tight * 2} ${tight * 2}`;
const svgBody = inner.replace(/fill="black"/g, 'class="s"');
w(
  'icon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"><style>.s{fill:${INK}}@media (prefers-color-scheme:dark){.s{fill:${PAPER}}}</style>${svgBody.trim()}</svg>\n`,
);

// ---- raster set -------------------------------------------------------------
const p16 = await png(16, 0.86);
const p32 = await png(32, 0.86);
const p48 = await png(48, 0.86);
const icoBuf = ico([
  { size: 16, data: p16 },
  { size: 32, data: p32 },
  { size: 48, data: p48 },
]);
w('favicon.ico', icoBuf);
w('icon-32.png', p32);
w('icon-48.png', p48);
w('icon-180.png', await png(180, 0.62));
w('icon-192.png', await png(192, 0.7));
w('icon-512.png', await png(512, 0.7));
// Maskable: the ring (and its dots) stay inside the centred 80% circle (radius 0.4 of the side).
w('icon-maskable-512.png', await png(512, 0.52));

// ---- Open Graph card (1200x630): wordmark + the cleared black polo photo ---
const W = 1200;
const H = 630;
const PHOTO = 630;
const photo = await sharp(join(out, 'hero-polo-black-1440.webp'))
  .extract({ left: 0, top: 380, width: 1440, height: 1440 })
  .resize(PHOTO, PHOTO)
  .toBuffer();
const wordmark = await sharp(Buffer.from(readFileSync(join(out, 'logo-white.svg'), 'utf8')), { density: 600 })
  .resize({ width: 400 })
  .png()
  .toBuffer();
const wm = await sharp(wordmark).metadata();
const og = await sharp({ create: { width: W, height: H, channels: 3, background: INK } })
  .composite([
    { input: photo, left: W - PHOTO, top: 0 },
    { input: wordmark, left: 64, top: Math.round(H / 2 - (wm.height ?? 0) / 2) },
  ])
  .jpeg({ quality: 86, mozjpeg: true })
  .toBuffer();
w('og-default.jpg', og);

// ---- data module for /favicon.ico -------------------------------------------
writeFileSync(
  join(root, 'src/lib/brand-icon-data.ts'),
  `// GENERATED by scripts/generate-brand-icons.mjs; do not edit. Base64 of public/brand-default/favicon.ico\n// so /favicon.ico answers 200 directly (no redirect) while an uploaded favicon can still override it.\nexport const FAVICON_ICO_BASE64 =\n  '${icoBuf.toString('base64')}';\n`,
);
console.log('wrote src/lib/brand-icon-data.ts');
