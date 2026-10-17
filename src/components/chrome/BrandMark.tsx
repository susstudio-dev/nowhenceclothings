import type { MediaRef } from '@/lib/schemas/common';
import { Wordmark } from '@/components/ui/Wordmark';

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

/** Uploaded logo when set, otherwise the typeset wordmark. */
export function BrandMark({
  brand,
  className,
  imgClassName = 'h-7 w-auto md:h-8',
}: {
  brand?: ChromeBrand;
  className?: string;
  imgClassName?: string;
}) {
  const logo = brand?.logoLight;
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoSrc(logo)} alt={logo.alt || brand?.name || brand?.wordmark || 'Home'} width={logo.width} height={logo.height} className={imgClassName} />
    );
  }
  return <Wordmark className={className} text={brand?.wordmark} />;
}
