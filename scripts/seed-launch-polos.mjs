#!/usr/bin/env node
// WS-G seed: five polos from assets/photography, written through the same
// local media layout the upload pipeline uses (public/media/{id}/{w}.webp +
// data/media-library.json). Four are coming soon (with pre-blurred copies, the
// only images the storefront receives), one is a presale example.
// Idempotent: re-running replaces the polo products and their media.
//   node scripts/seed-launch-polos.mjs
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const DATA = path.join(ROOT, 'data');
const MEDIA = path.join(ROOT, 'public', 'media');
const PHOTOS = path.join(ROOT, 'assets', 'photography');
const T = '2026-10-17T00:00:00.000Z';
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const WIDTHS = [480, 800, 1200, 1600];
const BLUR_WIDTHS = [480, 800];
const BLUR_STRENGTH = 30;

const read = (f) => JSON.parse(readFileSync(path.join(DATA, f), 'utf8'));
const write = (f, v) => writeFileSync(path.join(DATA, f), JSON.stringify(v, null, 2) + '\n');

/** Crop to 4:5 and write every width as WebP. Returns a MediaRef. */
async function putImage(file, id, alt) {
  const src = sharp(path.join(PHOTOS, file)).rotate();
  const meta = await src.metadata();
  const W = Math.min(1600, meta.width, Math.floor((meta.height * 4) / 5));
  const H = Math.round((W * 5) / 4);
  const base = await src.resize(W, H, { fit: 'cover', position: 'attention' }).toBuffer();
  const widths = WIDTHS.filter((w) => w <= W);
  if (!widths.length) widths.push(W);
  mkdirSync(path.join(MEDIA, id), { recursive: true });
  for (const w of widths) {
    await sharp(base).resize(w).webp({ quality: 82 }).toFile(path.join(MEDIA, id, `${w}.webp`));
  }
  return { ref: { id, alt, width: W, height: H, widths, formats: ['webp'] }, base };
}

/** Pre-blurred copy (downscale hard, blur, upscale) — matches the admin's canvas pipeline. */
async function putBlurred(base, W, H, id, alt) {
  const small = Math.max(6, Math.round(W / (2 + BLUR_STRENGTH / 2)));
  const tiny = await sharp(base).resize(small).toBuffer();
  const widths = BLUR_WIDTHS.filter((w) => w <= W);
  mkdirSync(path.join(MEDIA, id), { recursive: true });
  for (const w of widths) {
    const h = Math.round((w * H) / W);
    await sharp(tiny)
      .resize(w, h, { kernel: 'cubic' })
      .blur(Math.max(2, (w * BLUR_STRENGTH) / 1000))
      .webp({ quality: 70 })
      .toFile(path.join(MEDIA, id, `${w}.webp`));
  }
  return { id, alt, width: widths.at(-1), height: Math.round((widths.at(-1) * H) / W), widths, formats: ['webp'] };
}

const POLOS = [
  {
    key: 'navy-rain-emboss',
    file: 'polo-navy-rain-emboss.jpg',
    title: 'Rain Emboss Polo',
    colour: ['navy', 'Navy', '#1F2A3D'],
    code: 'PRN',
    price: 349900,
    availability: 'coming_soon',
    teaser: 'A deep navy piqué with a tonal rain pattern pressed into the cloth. Felt before it is seen.',
    fabric: '220 GSM cotton piqué, heat-embossed',
  },
  {
    key: 'rust-wing-sleeve',
    file: 'polo-rust-wing-sleeve.jpg',
    title: 'Wing Sleeve Polo',
    colour: ['rust', 'Rust', '#8A4A2F'],
    code: 'PWS',
    price: 349900,
    availability: 'coming_soon',
    teaser: 'Burnt rust, with a quiet detail on the sleeve you will notice on the second look.',
    fabric: '220 GSM cotton piqué',
  },
  {
    key: 'cream-diamond-back',
    file: 'polo-cream-diamond-back.jpg',
    title: 'Diamond Back Polo',
    colour: ['cream', 'Cream', '#E9E1CF'],
    code: 'PDB',
    price: 369900,
    availability: 'coming_soon',
    teaser: 'Cream knit, front kept clean. The story is on the back.',
    fabric: 'Cotton knit with jacquard back panel',
  },
  {
    key: 'olive-pebble-hem',
    file: 'polo-olive-pebble-hem.png',
    title: 'Pebble Hem Polo',
    colour: ['olive', 'Olive', '#5B5E44'],
    code: 'PPH',
    price: 349900,
    availability: 'coming_soon',
    teaser: 'Olive, washed soft, finished at the hem with something small and deliberate.',
    fabric: '220 GSM garment-washed cotton piqué',
  },
  {
    key: 'black-ring-embroidered',
    file: 'polo-black-embroidered-detail.jpg',
    title: 'Ring Embroidered Polo',
    colour: ['black', 'Black', '#141412'],
    code: 'PRE',
    price: 379900,
    availability: 'presale',
    description:
      'A heavyweight black polo with a tonal ring embroidered at the chest. Pre-order now; made in one small run and shipped together.',
    fabric: '240 GSM mercerised cotton piqué, tonal embroidery',
    presale: {
      enabled: true,
      startsAt: '2026-10-17T00:00:00.000Z',
      endsAt: '2026-11-30T18:29:00.000Z',
      price: 329900,
      cap: 60,
      perCustomerLimit: 2,
      shipBy: '2026-12-15',
      access: 'public',
    },
  },
];

const catalogue = read('catalogue.json');
const library = read('media-library.json');
const inventory = read('inventory.json');
const ids = new Set(POLOS.map((p) => `prod-polo-${p.key}`));
catalogue.products = catalogue.products.filter((p) => !ids.has(p.id));
// Media ids are random (like uploads), so a blurred id never reveals or
// guesses the sharp original. Remove the previous run's files first.
const isSeedPolo = (m) => m.uploadedBy === 'seed' && /^seed-polo|^polo-/.test(m.name ?? '');
for (const m of library.items.filter(isSeedPolo)) rmSync(path.join(MEDIA, m.id), { recursive: true, force: true });
library.items = library.items.filter((m) => !isSeedPolo(m));
const rid = () => `seed-${randomBytes(8).toString('hex')}`;

let order = 100;
for (const p of POLOS) {
  const [colourId, colourName, hex] = p.colour;
  const alt = `${p.title} in ${colourName}`;
  const mediaId = rid();
  const { ref, base } = await putImage(p.file, mediaId, alt);
  library.items.push({ ...ref, name: p.file, uploadedAt: T, uploadedBy: 'seed' });
  let comingSoon;
  if (p.availability === 'coming_soon') {
    const blurId = rid();
    const blurred = await putBlurred(base, ref.width, ref.height, blurId, 'Blurred preview');
    library.items.push({ ...blurred, name: `seed-polo-${p.key}-blurred.webp`, uploadedAt: T, uploadedBy: 'seed' });
    comingSoon = { revealTo: 'available', teaser: p.teaser, blurred: [{ sourceId: mediaId, strength: BLUR_STRENGTH, media: blurred }] };
  }
  const variants = SIZES.map((s) => ({ sku: `NWH-${p.code}-${colourId.toUpperCase().slice(0, 3)}-${s}`, colourId, size: s }));
  for (const v of variants) inventory[v.sku] ??= { stock: 0, reserved: 0, lowStockAt: 3 };
  catalogue.products.push({
    id: `prod-polo-${p.key}`,
    slug: `polo-${p.key}`,
    title: p.title,
    description: p.description ?? `${p.teaser} Unisex, cut for every body.`,
    categoryId: 'cat-tops',
    collectionIds: ['col-core'],
    status: 'active',
    price: p.price,
    colours: [{ id: colourId, name: colourName, hex, images: [ref] }],
    sizes: SIZES,
    variants,
    fabric: p.fabric,
    care: 'Cold wash inside out. Dry flat in shade. Do not iron on the detail.',
    fit: 'Unisex regular fit. Size down for a closer fit.',
    sizeChartId: 'chart-tops',
    relatedIds: [],
    sortOrder: order++,
    seo: {},
    availability: p.availability,
    ...(comingSoon ? { comingSoon } : {}),
    ...(p.presale ? { presale: p.presale } : {}),
    createdAt: T,
    updatedAt: T,
  });
}

write('catalogue.json', catalogue);
write('media-library.json', library);
write('inventory.json', inventory);
console.log(`Seeded ${POLOS.length} polos.`);
