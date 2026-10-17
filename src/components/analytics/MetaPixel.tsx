import { Suspense } from 'react';
import Script from 'next/script';
import { normalisePixelId, pixelBootstrap, pixelNoscriptSrc } from '@/lib/analytics/meta';
import { MetaPixelTracker } from './MetaPixelTracker';

/**
 * Meta Pixel base code, rendered by the root layout for storefront requests
 * only (the layout passes no id on /admin). The bootstrap runs after
 * hydration (next/script afterInteractive) and sends the first PageView;
 * MetaPixelTracker sends PageView on later client-side navigations.
 * Server component on purpose: the id comes from settings at request time.
 */
export function MetaPixel({ pixelId }: { pixelId: string }) {
  const id = normalisePixelId(pixelId);
  if (!id) return null;
  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: pixelBootstrap(id) }} />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img height={1} width={1} style={{ display: 'none' }} alt="" src={pixelNoscriptSrc(id)} />
      </noscript>
      <Suspense fallback={null}>
        <MetaPixelTracker />
      </Suspense>
    </>
  );
}
