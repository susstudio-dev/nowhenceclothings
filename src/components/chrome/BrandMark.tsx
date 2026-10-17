import type { MediaRef } from '@/lib/schemas/common';
import { Wordmark } from '@/components/ui/Wordmark';
import { LogoWordmark } from '@/components/ui/Logo';

/** Owner brand for the chrome (A9b), from settings.brand. */
export interface ChromeBrand {
  /** Store name, used for accessible labels. */
  name?: string;
  wordmark?: string;
  logoLight?: MediaRef;
  logoDark?: MediaRef;
}

export function logoSrc(m: MediaRef, minWidth = 480): string {
  if (m.src) return m.src;
  const w = m.widths.find((x) => x >= minWidth) ?? m.widths[m.widths.length - 1] ?? m.width;
  return `/media/${m.id}/${w}.webp`;
}

/**
 * Uploaded logo when set (Settings -> Brand); otherwise the owner's SVG
 * wordmark (A12) while the wordmark text is the default, or the typeset text
 * when the owner changed it. `tone="dark"` = sits on dark imagery: uses the
 * dark-surface upload, and the SVG inherits a light currentColor.
 */
export function BrandMark({
  brand,
  className,
  imgClassName = 'h-7 w-auto md:h-8',
  svgClassName,
  tone = 'light',
}: {
  brand?: ChromeBrand;
  className?: string;
  imgClassName?: string;
  svgClassName?: string;
  tone?: 'light' | 'dark';
}) {
  const logo = tone === 'dark' ? (brand?.logoDark ?? brand?.logoLight) : brand?.logoLight;
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoSrc(logo)} alt={logo.alt || brand?.name || brand?.wordmark || 'Home'} width={logo.width} height={logo.height} className={imgClassName} />
    );
  }
  const text = brand?.wordmark?.trim();
  if (!text || text.toUpperCase() === 'NOWHENCE') {
    return <LogoWordmark className={svgClassName} title={brand?.name || 'Nowhence'} />;
  }
  return <Wordmark className={className} text={text} />;
}
