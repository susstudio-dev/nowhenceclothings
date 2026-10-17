import Link from 'next/link';
import { Image } from '@/components/ui';
import type { MediaRef } from '@/lib/schemas/common';

/**
 * Home brand moment (S1): the site-content hero line set large next to a close crop of the cloth.
 * Used when a presale piece takes the lead slot, so the owner's heading / subheading / image still lead the story.
 */
export function HomeEditorial({
  heading,
  body,
  media,
  cta,
}: {
  heading: string;
  body?: string;
  media?: MediaRef;
  cta?: { label: string; href: string };
}) {
  return (
    <section aria-labelledby="home-editorial" className="container-page py-section">
      <div className="grid gap-12 md:grid-cols-12 md:gap-8">
        {/* The line sits at the top of the column, the quiet text at the foot, level with the photograph. */}
        <div className="flex flex-col justify-between gap-10 md:col-span-6 lg:col-span-7">
          <h2 id="home-editorial" className="-mt-[0.08em] text-balance font-display text-display font-light lg:text-[5rem] lg:leading-none lg:tracking-[-0.02em]">
            {heading}
          </h2>
          {(body || cta) && (
            <div className="flex flex-col items-start gap-6">
              {body && <p className="max-w-xs text-small text-ink-soft md:text-body">{body}</p>}
              {cta && (
                <Link href={cta.href} className="link-underline pb-1 text-label uppercase text-ink">
                  {cta.label}
                </Link>
              )}
            </div>
          )}
        </div>
        {media && (
          <figure className="relative aspect-garment overflow-hidden bg-paper-deep md:col-span-5 md:col-start-8 lg:col-span-4 lg:col-start-9">
            {/* A closer crop than the hero (oversized, offset into the cloth): the embroidery reads as texture. */}
            <Image
              media={media}
              sizes="(min-width: 768px) 60vw, 150vw"
              className="absolute -left-[38%] -top-[12%] h-[140%] w-[140%] !max-w-none object-cover"
            />
          </figure>
        )}
      </div>
    </section>
  );
}
