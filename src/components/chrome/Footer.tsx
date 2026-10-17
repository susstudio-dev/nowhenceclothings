import Link from 'next/link';
import type { ReactNode } from 'react';
import type { SiteContentDoc } from '@/lib/schemas/site-content';
import { cn } from '@/components/ui/cn';
import { Wordmark } from '@/components/ui/Wordmark';

export interface FooterProps {
  /** site-content `nav.footer` column groups. */
  columns: SiteContentDoc['nav']['footer'];
  /** Newsletter form slot (WS-B/WS-C own the form and its API). */
  newsletter?: ReactNode;
  /** Contact email from settings `store.email`. */
  email?: string;
  className?: string;
}

/** Editorial footer: oversized wordmark, link columns, newsletter slot, small print. Server component. */
export function Footer({ columns, newsletter, email, className }: FooterProps) {
  const year = new Date().getFullYear();
  return (
    <footer className={cn('mt-section border-t border-line bg-paper', className)}>
      <div className="container-page grid gap-12 py-16 md:grid-cols-12 md:py-20">
        <div className="md:col-span-5">
          <p className="font-display text-h3 text-ink">Made to outlast the season.</p>
          {newsletter && <div className="mt-8 max-w-sm">{newsletter}</div>}
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-10 sm:grid-cols-3 md:col-span-7">
          {columns.map((col) => (
            <div key={col.heading}>
              <h2 className="eyebrow mb-4 font-sans">{col.heading}</h2>
              <ul className="flex flex-col gap-3">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="link-underline text-small text-ink-soft hover:text-ink">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="container-page overflow-hidden" aria-hidden="true">
        <Wordmark className="block select-none whitespace-nowrap text-[18vw] leading-[0.8] tracking-[0.04em] text-ink md:text-[16vw]" />
      </div>
      <div className="container-page flex flex-col gap-2 border-t border-line py-6 text-caption text-muted md:flex-row md:justify-between">
        <p>&copy; {year} Nowhence. All rights reserved.</p>
        {email && (
          <p>
            <a href={`mailto:${email}`} className="link-underline hover:text-ink">
              {email}
            </a>
          </p>
        )}
      </div>
    </footer>
  );
}
