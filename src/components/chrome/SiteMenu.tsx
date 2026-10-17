'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { NavItem } from '@/lib/schemas/site-content';
import { cn } from '@/components/ui/cn';
import { IconArrowRight } from '@/components/ui/icons';
import type { HeaderAnnouncement } from './announcement';
import { HeaderStatus } from './HeaderStatus';

export interface MenuColumn {
  heading: string;
  links: { label: string; href: string }[];
}

export interface SiteMenuProps {
  id: string;
  open: boolean;
  onClose: () => void;
  nav: NavItem[];
  columns: MenuColumn[];
  announcement?: HeaderAnnouncement;
  searchHref: string;
  isActive: (href: string) => boolean;
}

/** Matches the 300ms panel fade so the exit finishes before unmount. */
const EXIT_MS = 300;

/**
 * The menu, dropped from the header bar (rendered inside it, under the bar, so the bar stays
 * put and "Menu" becomes "Close"). Full screen on mobile, a paper panel over a dimmed page on
 * desktop. Primary items in Jost light, large; search and the secondary columns beside them.
 * Focus trap, Escape and scroll lock are owned by the Header.
 */
export function SiteMenu({ id, open, onClose, nav, columns, announcement, searchHref, isActive }: SiteMenuProps) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(t);
  }, [open]);

  // First menu item takes focus once the panel is in the DOM (the Header's trap restores it to Menu).
  useEffect(() => {
    if (open && mounted) document.getElementById(id)?.querySelector<HTMLElement>('[data-menu-first]')?.focus({ preventScroll: true });
  }, [id, open, mounted]);

  const cols = columns.filter((c) => c.links.length > 0);

  return (
    <div id={id} hidden={!mounted}>
      {mounted && (
        <>
          {/* Desktop: the page stays visible below the panel, dimmed; a click there closes. */}
          <div
            aria-hidden="true"
            onClick={onClose}
            className={cn(
              'fixed inset-0 hidden bg-ink/25 transition-opacity duration-slow ease-out lg:block',
              shown ? 'opacity-100' : 'opacity-0',
            )}
          />
          <div
            className={cn(
              'fixed inset-x-0 top-0 flex h-[100dvh] flex-col overflow-y-auto overscroll-contain bg-paper pt-header text-ink transition-[opacity,transform] duration-slow ease-out lg:h-auto lg:max-h-[100dvh] lg:border-b lg:border-line',
              shown ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0',
            )}
          >
            <nav aria-label="Menu" className="container-page flex flex-1 flex-col pb-10 pt-6 md:pt-12 lg:grid lg:flex-none lg:grid-cols-12 lg:gap-x-6 lg:pb-16 lg:pt-14">
              {announcement && (
                <div className="-mt-1 mb-8 border-b border-line pb-5 md:hidden">
                  <HeaderStatus announcement={announcement} size="menu" onNavigate={onClose} />
                </div>
              )}

              <ul className="group/list lg:col-span-7">
                {nav.map((item, i) => (
                  <li
                    key={item.href}
                    className={cn(shown && 'animate-rise-in')}
                    style={{ animationDelay: `${60 + Math.min(i, 6) * 45}ms` }}
                  >
                    <Link
                      href={item.href}
                      onClick={onClose}
                      data-menu-first={i === 0 || undefined}
                      aria-current={isActive(item.href) ? 'page' : undefined}
                      className="inline-block py-1 font-display text-[2.375rem] font-light leading-[1.12] tracking-[-0.02em] text-ink transition-opacity duration-base ease-out focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 group-hover/list:opacity-35 hover:!opacity-100 aria-[current=page]:underline aria-[current=page]:decoration-1 aria-[current=page]:underline-offset-[0.16em] md:text-[3rem] lg:text-[clamp(2.75rem,4vw,3.75rem)]"
                    >
                      {item.label}
                    </Link>
                    {item.children.length > 0 && (
                      <ul className="mb-3 mt-1 flex flex-wrap gap-x-5 gap-y-1">
                        {item.children.map((c) => (
                          <li key={c.href}>
                            <Link href={c.href} onClick={onClose} className="link-underline text-small text-muted hover:text-ink">
                              {c.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>

              <div
                className={cn('mt-auto pt-14 lg:col-span-4 lg:col-start-9 lg:mt-3 lg:pt-0', shown && 'animate-rise-in')}
                style={{ animationDelay: `${60 + Math.min(nav.length, 6) * 45}ms` }}
              >
                <form action={searchHref} method="get" role="search" className="group/search relative">
                  <label htmlFor={`${id}-q`} className="sr-only">
                    Search the store
                  </label>
                  <input
                    id={`${id}-q`}
                    name="q"
                    type="search"
                    autoComplete="off"
                    placeholder="Search"
                    className="h-12 w-full rounded-none border-0 border-b border-line bg-transparent pr-10 font-sans text-body text-ink placeholder:text-muted focus:border-ink focus:outline-none focus:ring-0 [&::-webkit-search-cancel-button]:hidden"
                  />
                  <button
                    type="submit"
                    aria-label="Search"
                    className="absolute right-0 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-end text-ink transition-opacity duration-fast hover:opacity-60 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2"
                  >
                    <IconArrowRight size={16} />
                  </button>
                </form>

                {cols.length > 0 && (
                  <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 lg:mt-12">
                    {cols.map((col) => (
                      <div key={col.heading}>
                        <p className="font-sans text-label uppercase text-muted">{col.heading}</p>
                        <ul className="mt-4 space-y-2.5">
                          {col.links.map((l) => (
                            <li key={l.href}>
                              <Link
                                href={l.href}
                                onClick={onClose}
                                aria-current={isActive(l.href) ? 'page' : undefined}
                                className="link-underline text-small text-ink-soft hover:text-ink aria-[current=page]:text-ink"
                              >
                                {l.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
