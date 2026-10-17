import { readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { FAVICON_ICO_BASE64 } from './brand-icon-data';
import { BUNDLED_ICONS, BUNDLED_ICON_SIZES, MIN_FAVICON_PX, iconMetadata, manifestIcons, usableFavicon } from './icons';

const pub = (url: string) => path.join(process.cwd(), 'public', url);
const upload = (width: number, over: Record<string, unknown> = {}) => ({ id: 'fav1', alt: '', width, height: width, widths: [width], ...over });

describe('bundled icon files', () => {
  it('every declared PNG exists at exactly its declared size', async () => {
    for (const [url, size] of Object.entries(BUNDLED_ICON_SIZES)) {
      const m = await sharp(pub(url)).metadata();
      expect([url, m.format, m.width, m.height]).toEqual([url, 'png', size, size]);
    }
  });

  it('manifest declares real sizes, with a separate maskable icon', async () => {
    const icons = manifestIcons(undefined);
    for (const i of icons) {
      const m = await sharp(pub(i.src)).metadata();
      expect(i.sizes).toBe(`${m.width}x${m.height}`);
      expect(i.type).toBe('image/png');
    }
    expect(icons.filter((i) => i.purpose === 'maskable')).toHaveLength(1);
    expect(icons.some((i) => i.sizes === '192x192' && i.purpose === 'any')).toBe(true);
    expect(icons.some((i) => i.sizes === '512x512' && i.purpose === 'any')).toBe(true);
    // A combined "any maskable" purpose is avoided: masking a full-bleed "any" icon crops it.
    expect(icons.every((i) => i.purpose === 'any' || i.purpose === 'maskable')).toBe(true);
  });

  it('maskable icon keeps the ring inside the 80% safe zone', async () => {
    const { data, info } = await sharp(pub(BUNDLED_ICONS.maskable512)).raw().toBuffer({ resolveWithObject: true });
    const bg = [data[0], data[1], data[2]];
    const radius = info.width * 0.4;
    const c = info.width / 2;
    let worst = 0;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * info.channels;
        const ink = Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 90;
        if (ink) worst = Math.max(worst, Math.hypot(x - c, y - c));
      }
    }
    expect(worst).toBeGreaterThan(0);
    expect(worst).toBeLessThanOrEqual(radius);
  });

  it('apple-touch-icon is the symbol on paper, opaque', async () => {
    const { data, info } = await sharp(pub(BUNDLED_ICONS.apple180)).raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([180, 180]);
    // Corner is the paper colour (#f4f4f2); no alpha channel, so iOS never paints black behind it.
    expect([data[0], data[1], data[2]]).toEqual([0xf4, 0xf4, 0xf2]);
    expect(info.channels).toBe(3);
  });

  it('favicon.ico holds 16, 32 and 48 px PNG entries, and the served bytes match the file', () => {
    const ico = readFileSync(pub('/brand-default/favicon.ico'));
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    const n = ico.readUInt16LE(4);
    const sizes: number[] = [];
    for (let i = 0; i < n; i++) {
      const e = 6 + i * 16;
      sizes.push(ico[e] || 256);
      const len = ico.readUInt32LE(e + 8);
      const off = ico.readUInt32LE(e + 12);
      // PNG signature at each payload.
      expect(ico.subarray(off, off + 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(off + len).toBeLessThanOrEqual(ico.length);
    }
    expect(sizes).toEqual([16, 32, 48]);
    // /favicon.ico serves the embedded copy: it must not drift from the committed file.
    expect(Buffer.from(FAVICON_ICO_BASE64, 'base64').equals(ico)).toBe(true);
  });

  it('SVG tab icon is the ring symbol and adapts to dark browser chrome', () => {
    const svg = readFileSync(pub(BUNDLED_ICONS.svg), 'utf8');
    expect(svg).toContain('prefers-color-scheme:dark');
    expect(svg).toContain('viewBox=');
    expect(svg).not.toMatch(/<text|<image|font-family/);
    // Ring + three dots.
    expect(svg.match(/<path/g)).toHaveLength(4);
  });

  it('the default social card is 1200x630', async () => {
    const m = await sharp(pub('/brand-default/og-default.jpg')).metadata();
    expect([m.format, m.width, m.height]).toEqual(['jpeg', 1200, 630]);
  });

  it('organization logo is a square PNG of at least 112px', async () => {
    const m = await sharp(pub(BUNDLED_ICONS.png512)).metadata();
    expect(m.width).toBe(m.height);
    expect(m.width!).toBeGreaterThanOrEqual(112);
  });
});

describe('owner upload override', () => {
  it('a usable upload replaces the whole bundled set', () => {
    expect(usableFavicon(upload(512))).toBeDefined();
    expect(iconMetadata(upload(512))).toEqual({ icon: '/icon.png', apple: '/icon.png' });
    const [m] = manifestIcons(upload(512));
    expect(m).toMatchObject({ src: '/icon.png', sizes: '512x512', type: 'image/webp', purpose: 'any' });
  });

  it('declares the size /icon.png really serves (smallest stored width >= 192)', () => {
    const [m] = manifestIcons(upload(1024, { widths: [256, 512, 1024] }));
    expect(m.sizes).toBe('256x256');
  });

  it('an upload below 48px is ignored, so the tab never shows a blurry 24px icon', () => {
    expect(MIN_FAVICON_PX).toBe(48);
    expect(usableFavicon(upload(24))).toBeUndefined();
    expect(usableFavicon(undefined)).toBeUndefined();
    expect(iconMetadata(upload(24))).toEqual(iconMetadata(undefined));
    expect(manifestIcons(upload(24))).toEqual(manifestIcons(undefined));
  });

  it('bundled head tags: ico, svg, 48px png and a 180px apple icon; never a wordmark', () => {
    const meta = iconMetadata(undefined) as { icon: { url: string }[]; apple: { url: string; sizes: string }[] };
    expect(meta.icon.map((i) => i.url)).toEqual([BUNDLED_ICONS.ico, BUNDLED_ICONS.svg, BUNDLED_ICONS.png48, BUNDLED_ICONS.png192]);
    expect(meta.apple).toEqual([{ url: BUNDLED_ICONS.apple180, sizes: '180x180', type: 'image/png' }]);
    for (const u of [...meta.icon, ...meta.apple].map((i) => i.url)) expect(u).not.toMatch(/logo|wordmark/i);
  });
});
