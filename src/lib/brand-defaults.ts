import type { MediaRef } from './schemas/common';

// Bundled owner assets (A12), served from public/brand-default/. Used only
// when the owner has not uploaded their own in Settings / site content.
// Only photos of released products may appear unblurred here: the black
// embroidered polo is the one cleared for the default hero.

export const DEFAULT_ICON = { png32: '/brand-default/icon-32.png', apple: '/brand-default/icon-180.png', png192: '/brand-default/icon-192.png', png512: '/brand-default/icon-512.png' } as const;

export const DEFAULT_HERO_MEDIA: MediaRef = {
  id: 'brand-default-hero',
  alt: 'Black Nowhence polo, close detail of tonal ring embroidery across the shoulder',
  width: 1440,
  height: 2560,
  widths: [640, 960, 1440],
  formats: ['avif', 'webp'],
  src: '/brand-default/hero-polo-black-1440.webp',
};

/** True when a media ref is unset or still a placeholder image. */
export function isPlaceholderMedia(m: MediaRef | undefined): boolean {
  return !m || (!!m.src && /placehold\.co|placeholder/i.test(m.src));
}
