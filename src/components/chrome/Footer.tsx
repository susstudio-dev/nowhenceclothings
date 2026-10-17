import Link from 'next/link';
import type { ReactNode } from 'react';
import type { SiteContentDoc } from '@/lib/schemas/site-content';
import { cn } from '@/components/ui/cn';
import { LogoSymbol } from '@/components/ui/Logo';
import { BrandMark, type ChromeBrand } from './BrandMark';

export interface FooterProps {
  /** site-content `nav.footer` column groups. */
  columns: SiteContentDoc['nav']['footer'];
  /** Newsletter form slot (WS-B/WS-C own the form and its API). */
  newsletter?: ReactNode;
  /** Contact email from settings `store.email`. */
  email?: string;
  className?: string;
  /** Owner brand from settings (A9). */
  brand?: ChromeBrand;
  /** Small-print owner name; defaults to brand name. */
  legalName?: string;
}

/**
 * Quiet footer (A17): newsletter left, link columns right, then one legal line
 * carrying a modest wordmark. No oversized logo. Server component.
 */
export function Footer({ columns, newsletter, email, className, brand, legalName }: FooterProps) {
  const year = new Date().getFullYear();
  const name = brand?.name || 'Nowhence';
  return (
    <footer className={cn('mt-section border-t border-line bg-paper text-ink', className)}>
      <div className="container-page grid gap-12 pb-12 pt-14 md:grid-cols-12 md:gap-8 md:pb-16 md:pt-20">
        <div className="min-w-0 md:col-span-5 lg:col-span-4">
          <h2 className="eyebrow text-ink">Letters</h2>
          <p className="mt-4 max-w-xs text-small text-ink-soft">
            New pieces and drop dates, a few times a season. Nothing else.
          </p>
          {newsletter && <div className="mt-6 w-full max-w-sm [&_input]:min-w-0">{newsletter}</div>}
        </div>
        <nav
          aria-label="Footer"
          className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 md:col-span-7 md:col-start-6 lg:col-span-6 lg:col-start-7"
        >
          {columns.map((col) => (
            <div key={col.heading}>
              <h2 className="eyebrow mb-4">{col.heading}</h2>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="link-underline text-small text-ink-soft transition-colors hover:text-ink">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {email && (
            <div>
              <h2 className="eyebrow mb-4">Contact</h2>
              <a href={`mailto:${email}`} className="link-underline break-all text-small text-ink-soft hover:text-ink">
                {email}
              </a>
            </div>
          )}
        </nav>
      </div>
      <div className="container-page">
        <div className="flex flex-col gap-4 border-t border-line py-6 md:flex-row md:items-center md:justify-between">
          <Link href="/" aria-label={`${name}, home`} className="inline-flex w-fit items-center gap-3 text-ink">
            <BrandMark
              brand={brand}
              className="text-[0.9375rem] tracking-mark"
              imgClassName="h-4 w-auto"
              svgClassName="h-2.5 w-auto"
            />
          </Link>
          <p className="flex items-center gap-2 text-caption text-muted">
            <LogoSymbol className="h-3 w-3 text-clay" />
            &copy; {year} {legalName || name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
