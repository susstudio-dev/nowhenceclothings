import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { fontVariables } from '@/components/chrome/fonts';
import { getSettings } from '@/lib/content';
import { brandCssText } from '@/lib/brand';
import { SettingsDoc } from '@/lib/schemas/settings';
import { DEFAULT_ICON } from '@/lib/brand-defaults';
import { DEFAULT_DESCRIPTION } from '@/lib/seo';

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
    title: { default: name, template: `%s · ${name}` },
    description: DEFAULT_DESCRIPTION,
    // Owner upload (Settings -> Brand) wins; otherwise the bundled symbol (A12).
    icons: s.brand.favicon
      ? { icon: '/icon.png', apple: '/icon.png' }
      : {
          icon: [
            { url: DEFAULT_ICON.png32, sizes: '32x32', type: 'image/png' },
            { url: DEFAULT_ICON.png192, sizes: '192x192', type: 'image/png' },
          ],
          apple: { url: DEFAULT_ICON.apple, sizes: '180x180' },
        },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const s = await loadSettings();
  return { themeColor: s.brand.colours.paper };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const s = await loadSettings();
  return (
    <html lang="en-IN" className={fontVariables}>
      <head>
        <style id="brand-vars" dangerouslySetInnerHTML={{ __html: brandCssText(s.brand) }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
