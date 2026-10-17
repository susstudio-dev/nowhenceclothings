import type { MetadataRoute } from 'next';
import { DEFAULT_DESCRIPTION } from '@/lib/seo';
import { getSettings } from '@/lib/content';

export const dynamic = 'force-dynamic';

/** Web app manifest from settings (A9: name, colours; icon via /icon.png). */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getSettings();
  const name = s.store.name || 'Nowhence';
  return {
    name,
    short_name: name,
    description: DEFAULT_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: s.brand.colours.paper,
    theme_color: s.brand.colours.ink,
    icons: [{ src: '/icon.png', sizes: '512x512', type: s.brand.favicon ? 'image/webp' : 'image/png' }],
  };
}
