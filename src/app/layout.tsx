import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import './globals.css';
import { fontVariables } from '@/components/chrome/fonts';
import { getSettings } from '@/lib/content';
import { brandCssText } from '@/lib/brand';
import { SettingsDoc } from '@/lib/schemas/settings';
import { iconMetadata } from '@/lib/icons';
import { BRAND, DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE, TITLE_SEPARATOR } from '@/lib/seo';
import { MetaPixel } from '@/components/analytics/MetaPixel';
import { isTrackedPath, normalisePixelId } from '@/lib/analytics/meta';

// Brand (A9) is read at request time: colours + fonts become CSS variables and
// the favicon comes from /icon.png (settings-driven), so no rebuild is needed.

async function loadSettings(): Promise<SettingsDoc> {
  try {
    return await getSettings();
  } catch {
    return SettingsDoc.parse({ shipping: { flatFee: 0, freeShippingThreshold: 0 }, store: { email: 'hello@nowhenceclothings.com' } });
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const s = await loadSettings();
  const name = s.store.name || 'Nowhence';
  return {
    metadataBase: new URL('https://nowhenceclothings.com'),
    title: { default: name, template: `%s${TITLE_SEPARATOR}${name}` },
    description: DEFAULT_DESCRIPTION,
    applicationName: name,
    // Owner upload (Settings -> Brand) wins; otherwise the bundled symbol (A12).
    icons: iconMetadata(s.brand.favicon),
    // Large result snippets and image previews; pages that set their own `robots` (noindex) replace this.
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
    // Defaults for pages that do not build their own cards (buildMetadata sets these per page).
    openGraph: { type: 'website', siteName: name || BRAND, locale: 'en_IN', images: [{ ...DEFAULT_OG_IMAGE }] },
    twitter: { card: 'summary_large_image' },
    // Search Console / Bing Webmaster verification, only when set in Settings -> Marketing.
    verification: {
      ...(s.seo.googleSiteVerification ? { google: s.seo.googleSiteVerification } : {}),
      ...(s.seo.bingSiteVerification ? { other: { 'msvalidate.01': s.seo.bingSiteVerification } } : {}),
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const s = await loadSettings();
  return { themeColor: s.brand.colours.paper };
}

/**
 * Meta Pixel id for this request, or '' (off). Settings -> Marketing owns the
 * id; /admin never gets the pixel. Middleware stamps `x-admin-path` on every
 * /admin request (custom-worker.mjs strips any client-sent copy, so a public
 * page cannot be cached without the pixel by spoofing it).
 */
async function pixelIdFor(s: SettingsDoc): Promise<string> {
  const adminPath = (await headers()).get('x-admin-path');
  if (adminPath && !isTrackedPath(adminPath)) return '';
  return normalisePixelId(s.analytics.metaPixelId);
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const s = await loadSettings();
  const pixelId = await pixelIdFor(s);
  return (
    <html lang="en-IN" className={fontVariables}>
      <head>
        <style id="brand-vars" dangerouslySetInnerHTML={{ __html: brandCssText(s.brand) }} />
      </head>
      <body>
        {/* Before children: its effects (bootstrap) run before page effects (ViewContent etc). */}
        {pixelId && <MetaPixel pixelId={pixelId} />}
        {children}
      </body>
    </html>
  );
}
