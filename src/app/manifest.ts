import type { MetadataRoute } from 'next';
import { DEFAULT_DESCRIPTION } from '@/lib/seo';
import { getSettings } from '@/lib/content';
import { manifestIcons } from '@/lib/icons';

export const dynamic = 'force-dynamic';

/** Web app manifest from settings (A9: name, colours; icons from lib/icons: bundled symbol or the owner's upload). */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getSettings();
  const name = s.store.name || 'Nowhence';
  return {
    id: '/',
    name,
    short_name: name,
    description: DEFAULT_DESCRIPTION,
    lang: 'en-IN',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    categories: ['shopping', 'fashion'],
    background_color: s.brand.colours.paper,
    // Same as the page's <meta name="theme-color"> so the browser frame does not change colour on install.
    theme_color: s.brand.colours.paper,
    // Declared sizes must match the files actually served (Chrome flags a mismatch).
    icons: manifestIcons(s.brand.favicon),
  };
}
