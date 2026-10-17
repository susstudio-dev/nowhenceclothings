'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { NavItem } from '@/lib/schemas/site-content';
import { cn } from '@/components/ui/cn';
import { IconSearch } from '@/components/ui/icons';
import { useFocusTrap, useScrollLock } from '@/components/ui/use-overlay';
import { BrandMark, type ChromeBrand } from './BrandMark';
import type { HeaderAnnouncement } from './announcement';
import { HeaderStatus } from './HeaderStatus';
import { headerActionClass } from './header-classes';
import { SiteMenu, type MenuColumn } from './SiteMenu';

export interface HeaderProps {
  /** Primary nav from site-content `nav.primary`. The first two show in the bar on desktop; all are in the menu. */
  nav: NavItem[];
  /** Items in the cart; shown next to the bag icon when > 0. */
  cartCount?: number;
  /**
   * Replaces the default bag link (e.g. a client button that opens the cart drawer).
   * WS-C can pass its own `<CartButton />` here; give it `headerActionClass` to match.
   */
  cartSlot?: ReactNode;
  /** Search page path. */
  searchHref?: string;
  className?: string;
  /** Owner brand from settings (A9); defaults to the NOWHENCE wordmark. */
  brand?: ChromeBrand;
  /** The announcement as a quiet status beside the wordmark (`resolveAnnouncement`). Omit to hide. */
  announcement?: HeaderAnnouncement;
  /** Secondary link groups for the menu (usually the footer columns). */
  menuColumns?: MenuColumn[];
}

/** How many primary items sit in the bar on desktop; the rest live in the menu. */
const BAR_ITEMS = 2;
/** Below this the header never hides (the hero, or the top of a page). */
const HIDE_AFTER = 160;

/**
 * Store header, "the masthead": a small wordmark on the left with the announcement beside it
 * as a dated status line; Shop, Coming soon and Menu on the right, then Search and Bag.
 * Over a full-bleed hero (`data-chrome-hero` on the first block in main) it is transparent
 * with paper type and turns to paper once the hero has passed. It slides away while reading
 * down and comes back on the first scroll up. The menu drops from the bar (full screen on mobile).
 */
export function Header({
  nav,
  cartCount = 0,
  cartSlot,
  searchHref = '/search',
  className,
  brand,
  announcement,
  menuColumns = [],
}: HeaderProps) {
  const pathname = usePathname();
  const ref = useRef<HTMLElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [pastHero, setPastHero] = useState(false);
  const openRef = useRef(open);
  openRef.current = open;

  const close = useCallback(() => setOpen(false), []);

  // Perf (audit): an IntersectionObserver on a 4px sentinel reports "scrolled" without reading scrollY on mount.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setScrolled(!entry!.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Over a hero, stay transparent until the hero has slid under the bar.
  useEffect(() => {
    setPastHero(false);
    const hero = document.querySelector('#main > [data-chrome-hero]:first-child');
    if (!hero || typeof IntersectionObserver === 'undefined') return;
    const h = ref.current?.offsetHeight ?? 64;
    const io = new IntersectionObserver(([entry]) => setPastHero(!entry!.isIntersecting), { rootMargin: `-${h}px 0px 0px 0px` });
    io.observe(hero);
    return () => io.disconnect();
  }, [pathname]);

  // Hide while reading down, show on the first scroll up. Attribute writes only: no re-render per frame.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let last = window.scrollY;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const dy = y - last;
      last = y;
      if (document.documentElement.hasAttribute('data-scroll-locked')) return;
      if (y < HIDE_AFTER || dy < -4) el.removeAttribute('data-hidden');
      // Keyboard focus in the bar keeps it shown; a mouse click that left focus on Menu does not.
      else if (dy > 4 && !openRef.current && !el.querySelector(':focus-visible')) el.setAttribute('data-hidden', '');
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    // A keyboard user tabbing into a hidden header gets it back.
    const onFocus = () => el.removeAttribute('data-hidden');
    window.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('focusin', onFocus);
    return () => {
      window.removeEventListener('scroll', onScroll);
      el.removeEventListener('focusin', onFocus);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  // Menu open: lock scroll, trap focus across bar + menu (Escape closes, focus returns to Menu),
  // and take the page out of the accessibility tree behind it.
  useScrollLock(open);
  useFocusTrap(ref, open, close);
  useEffect(() => {
    if (!open) return;
    ref.current?.removeAttribute('data-hidden');
    const behind = Array.from(document.querySelectorAll<HTMLElement>('#main, body > footer, [data-site-footer]'));
    behind.forEach((n) => n.setAttribute('inert', ''));
    return () => behind.forEach((n) => n.removeAttribute('inert'));
  }, [open]);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname?.startsWith(`${href}/`));
  const barItems = nav.slice(0, BAR_ITEMS);
  const name = brand?.name || 'Nowhence';
  const hasUpload = Boolean(brand?.logoLight || brand?.logoDark);
  const mark = (tone: 'light' | 'dark') => (
    <BrandMark
      brand={brand}
      tone={tone}
      imgClassName="h-5 w-auto md:h-6"
      svgClassName="h-3 w-auto md:h-[0.9375rem]"
      className="text-[1.0625rem] tracking-mark md:text-[1.1875rem]"
    />
  );

  return (
    <>
      <div ref={sentinel} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 h-1 w-px" />
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header
        ref={ref}
        className={cn('site-header sticky top-0 z-header data-[open]:z-[45]', className)}
        data-scrolled={scrolled || undefined}
        data-solid={pastHero || open || undefined}
        data-open={open || undefined}
      >
        <SiteMenu
          id="site-menu"
          open={open}
          onClose={close}
          nav={nav}
          columns={menuColumns}
          announcement={announcement}
          searchHref={searchHref}
          isActive={isActive}
        />
        <span aria-hidden="true" className="hdr-shade pointer-events-none absolute inset-x-0 top-0" />
        <span aria-hidden="true" className="hdr-bg pointer-events-none absolute inset-0 bg-paper" />
        <span aria-hidden="true" className="hdr-rule pointer-events-none absolute inset-x-0 bottom-0 h-px bg-line" />

        <div className="hdr-bar container-page relative z-10 flex h-header items-center">
          <Link href="/" aria-label={`${name}, home`} className="-my-2 inline-flex shrink-0 items-center py-3 transition-opacity duration-fast hover:opacity-70 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4">
            {hasUpload ? (
              <>
                <span className="hdr-on-paper inline-flex">{mark('light')}</span>
                <span className="hdr-on-hero">{mark('dark')}</span>
              </>
            ) : (
              mark('light')
            )}
          </Link>

          {announcement && <HeaderStatus announcement={announcement} className="ml-10 hidden md:inline-flex lg:ml-14" />}

          <div className="ml-auto flex items-center gap-6 lg:gap-12">
            <div className="flex items-center gap-7">
              {barItems.length > 0 && (
                <nav aria-label="Primary" className="hidden lg:block">
                  <ul className="flex items-center gap-7">
                    {barItems.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={isActive(item.href) ? 'page' : undefined}
                          className="group inline-flex h-10 items-center font-sans text-label uppercase text-current focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2"
                        >
                          <span
                            className={cn(
                              'link-underline py-1 group-hover:bg-[length:100%_1px] group-focus-visible:bg-[length:100%_1px]',
                              isActive(item.href) && 'bg-[length:100%_1px]',
                            )}
                          >
                            {item.label}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}
              <button
                type="button"
                className={cn(headerActionClass, 'min-w-[3.25rem] justify-start')}
                aria-expanded={open}
                aria-controls="site-menu"
                onClick={() => setOpen((o) => !o)}
              >
                {open ? 'Close' : 'Menu'}
                {/* Mobile has no room for the status in the bar: its dot rides on Menu, the line is inside. */}
                {announcement && !open && <span aria-hidden="true" className="nh-live -mt-2 h-[5px] w-[5px] rounded-full bg-clay md:hidden" />}
              </button>
            </div>
            <div className="flex items-center gap-5 lg:gap-6">
              <Link href={searchHref} aria-label="Search" className={cn(headerActionClass, 'hidden lg:inline-flex')}>
                <IconSearch size={18} />
              </Link>
              {/* Opening the bag closes the menu first. */}
              <div className="contents" onClickCapture={close}>
                {cartSlot ?? (
                  <Link
                    href="/cart"
                    aria-label={cartCount > 0 ? `Bag, ${cartCount} item${cartCount === 1 ? '' : 's'}` : 'Bag, empty'}
                    className={headerActionClass}
                  >
                    <span>Bag</span>
                    <span aria-hidden="true" className="tabular-nums">
                      {cartCount}
                    </span>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
