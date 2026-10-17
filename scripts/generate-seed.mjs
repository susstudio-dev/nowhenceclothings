#!/usr/bin/env node
// Regenerates the placeholder seed docs in data/. Placeholder catalogue (D12):
// replace with the real one before launch. Validated by src/lib/seed.test.ts.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const DATA = path.join(process.cwd(), 'data');
mkdirSync(DATA, { recursive: true });
const T = '2026-10-17T00:00:00.000Z';
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const img = (id, alt) => ({ id, alt, width: 1600, height: 2000, widths: [], src: `https://placehold.co/1600x2000/EDEAE4/141412?text=${encodeURIComponent(alt)}` });

const defs = [
  ['tee-heavyweight', 'Heavyweight Tee', 'cat-tops', 'TEE', 249900, undefined, [['bone', 'Bone', '#E8E2D6'], ['ink', 'Ink', '#141412']], 'chart-tops', '240 GSM combed cotton jersey', 'Relaxed, dropped shoulder'],
  ['tee-pocket', 'Pocket Tee', 'cat-tops', 'PKT', 219900, 259900, [['stone', 'Stone', '#B9B2A5'], ['olive', 'Olive', '#5B5E44']], 'chart-tops', '200 GSM organic cotton', 'Regular'],
  ['overshirt-twill', 'Twill Overshirt', 'cat-tops', 'OVS', 549900, undefined, [['khaki', 'Khaki', '#A89A78'], ['ink', 'Ink', '#141412']], 'chart-tops', 'Brushed cotton twill', 'Boxy'],
  ['overshirt-linen', 'Linen Overshirt', 'cat-tops', 'LIN', 589900, undefined, [['sand', 'Sand', '#D8CDB8']], 'chart-tops', '100% European linen', 'Relaxed'],
  ['hoodie-loopback', 'Loopback Hoodie', 'cat-tops', 'HOD', 449900, undefined, [['heather', 'Heather Grey', '#9C9C98'], ['ink', 'Ink', '#141412']], 'chart-tops', '400 GSM loopback French terry', 'Oversized'],
  ['hoodie-zip', 'Zip Hoodie', 'cat-tops', 'ZIP', 489900, 549900, [['forest', 'Forest', '#2F3B30']], 'chart-tops', '380 GSM brushed fleece', 'Regular'],
  ['trouser-pleated', 'Pleated Trouser', 'cat-bottoms', 'PLT', 529900, undefined, [['charcoal', 'Charcoal', '#3A3A38'], ['bone', 'Bone', '#E8E2D6']], 'chart-bottoms', 'Wool-blend suiting', 'Wide, high rise'],
  ['trouser-cargo', 'Utility Cargo', 'cat-bottoms', 'CRG', 479900, undefined, [['olive', 'Olive', '#5B5E44']], 'chart-bottoms', 'Cotton ripstop', 'Straight'],
];

const products = defs.map(([slug, title, categoryId, code, price, compareAtPrice, colours, sizeChartId, fabric, fit], i) => {
  const cols = colours.map(([id, name, hex]) => ({ id, name, hex, images: [img(`${slug}-${id}-1`, `${title} in ${name}`), img(`${slug}-${id}-2`, `${title} in ${name}, detail`)] }));
  return {
    id: `prod-${slug}`,
    slug,
    title,
    description: `${title}. Cut for every body, made to be worn for years.`,
    categoryId,
    collectionIds: ['col-core'],
    ...(slug === 'overshirt-linen' || slug === 'hoodie-zip' ? { dropId: 'drop-001' } : {}),
    status: 'active',
    price,
    ...(compareAtPrice ? { compareAtPrice } : {}),
    colours: cols,
    sizes: SIZES,
    variants: cols.flatMap((c) => SIZES.map((s) => ({ sku: `NWH-${code}-${c.id.toUpperCase().slice(0, 3)}-${s}`, colourId: c.id, size: s }))),
    fabric,
    care: 'Cold wash inside out. Line dry. Warm iron.',
    fit,
    sizeChartId,
    relatedIds: [],
    sortOrder: i,
    seo: {},
    createdAt: T,
    updatedAt: T,
  };
});
products[0].relatedIds = ['prod-trouser-pleated', 'prod-overshirt-twill'];

const catalogue = {
  version: 1,
  products,
  categories: [
    { id: 'cat-tops', slug: 'tops', name: 'Tops', description: 'Tees, overshirts and hoodies.', sortOrder: 0, seo: {} },
    { id: 'cat-bottoms', slug: 'bottoms', name: 'Bottoms', description: 'Trousers.', sortOrder: 1, seo: {} },
  ],
  collections: [{ id: 'col-core', slug: 'core', name: 'Core', description: 'The permanent collection.', sortOrder: 0, seo: {} }],
  drops: [{ id: 'drop-001', name: 'Drop 001 — Off Season', slug: 'drop-001', releaseAt: '2026-11-15T12:30:00.000Z', description: 'Linen and fleece, in limited numbers.', seo: {} }],
  sizeCharts: [
    {
      id: 'chart-tops', name: 'Unisex tops', measurements: ['chest', 'length', 'shoulder'],
      rows: SIZES.map((size, i) => ({ size, values: { chest: 104 + i * 6, length: 68 + i * 2, shoulder: 50 + i * 2 } })),
      modelNote: 'Model is 183 cm wearing M',
    },
    {
      id: 'chart-bottoms', name: 'Unisex bottoms', measurements: ['waist', 'hip', 'inseam'],
      rows: SIZES.map((size, i) => ({ size, values: { waist: 70 + i * 5, hip: 96 + i * 5, inseam: 76 + Math.min(i, 3) } })),
      modelNote: 'Model is 183 cm wearing M',
    },
  ],
};

const inventory = {};
products.forEach((p, pi) => p.variants.forEach((v, vi) => {
  inventory[v.sku] = { stock: (pi + vi) % 7 === 0 ? 0 : 3 + ((pi * 5 + vi * 3) % 20), reserved: 0, lowStockAt: 3 };
}));

const settings = {
  currency: 'INR',
  shipping: { flatFee: 9900, freeShippingThreshold: 299900, eta: 'Ships in 2–4 working days' },
  tax: { pricesIncludeTax: true, gstRatePercent: 12, gstin: '' },
  store: { name: 'Nowhence', legalName: '', email: 'hello@nowhenceclothings.com', phone: '', address: '', instagram: '' },
  orders: { paymentWindowMinutes: 30, returnWindowDays: 7, maxQtyPerLine: 10 },
  email: { from: 'Nowhence <orders@nowhenceclothings.com>', replyTo: 'hello@nowhenceclothings.com' },
};

const coupons = {
  coupons: [
    { id: 'cpn-welcome10', code: 'WELCOME10', type: 'percent', value: 10, maxDiscount: 50000, description: '10% off your first order', active: true, minOrder: 199900, usedCount: 0, createdAt: T },
    { id: 'cpn-flat500', code: 'FLAT500', type: 'flat', value: 50000, description: '₹500 off above ₹4,999', active: true, minOrder: 499900, usageLimit: 100, usedCount: 0, createdAt: T },
    { id: 'cpn-freeship', code: 'FREESHIP', type: 'free_shipping', description: 'Free shipping', active: true, minOrder: 0, expiresAt: '2026-12-31T18:29:59.000Z', usedCount: 0, createdAt: T },
  ],
};

const page = (slug, title, md) => ({ slug, title, blocks: [{ type: 'richText', id: `${slug}-body`, markdown: md }], seo: {} });
const siteContent = {
  announcement: { enabled: true, text: 'Free shipping on orders above ₹2,999', href: '/shipping' },
  nav: {
    primary: [
      { label: 'Shop', href: '/shop', children: [{ label: 'Tops', href: '/shop/tops' }, { label: 'Bottoms', href: '/shop/bottoms' }] },
      { label: 'Drop 001', href: '/drops/drop-001', children: [] },
      { label: 'Lookbook', href: '/lookbook', children: [] },
      { label: 'Journal', href: '/journal', children: [] },
    ],
    footer: [
      { heading: 'Help', links: [{ label: 'Shipping', href: '/shipping' }, { label: 'Returns & exchange', href: '/returns' }, { label: 'Size guide', href: '/size-guide' }, { label: 'FAQ', href: '/faq' }, { label: 'Track order', href: '/orders/track' }] },
      { heading: 'Nowhence', links: [{ label: 'About', href: '/about' }, { label: 'Contact', href: '/contact' }, { label: 'Privacy', href: '/privacy' }, { label: 'Terms', href: '/terms' }] },
    ],
  },
  home: {
    blocks: [
      { type: 'hero', id: 'home-hero', heading: 'Clothes from nowhere in particular.', subheading: 'Unisex essentials, made slowly.', media: img('home-hero', 'Campaign'), cta: { label: 'Shop the core', href: '/shop' } },
      { type: 'featuredDrop', id: 'home-drop', dropId: 'drop-001' },
      { type: 'categoryTiles', id: 'home-cats', heading: 'Shop by category', categoryIds: ['cat-tops', 'cat-bottoms'] },
      { type: 'story', id: 'home-story', heading: 'Made to outlast the season', body: 'Placeholder story copy.', media: img('home-story', 'Studio') },
      { type: 'newsletter', id: 'home-news', heading: 'Hear about drops first', body: 'No noise. A few emails a season.' },
    ],
    seo: {},
  },
  pages: Object.fromEntries([
    ['about', 'About'], ['contact', 'Contact'], ['faq', 'FAQ'], ['size-guide', 'Size guide'],
    ['shipping', 'Shipping'], ['returns', 'Returns & exchange'], ['privacy', 'Privacy policy'], ['terms', 'Terms of service'],
  ].map(([s, t]) => [s, page(s, t, `Placeholder ${t.toLowerCase()} copy.`)])),
  lookbook: [],
  journal: [],
};

const write = (name, doc) => writeFileSync(path.join(DATA, name), JSON.stringify(doc, null, 2) + '\n');
write('catalogue.json', catalogue);
write('inventory.json', inventory);
write('settings.json', settings);
write('coupons.json', coupons);
write('site-content.json', siteContent);
console.log(`seeded ${products.length} products, ${Object.keys(inventory).length} SKUs`);
