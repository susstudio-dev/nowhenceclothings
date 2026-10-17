'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import type { NavItem } from '@/lib/schemas/site-content';
import { cn } from '@/components/ui/cn';
import { IconBag, IconMenu, IconSearch } from '@/components/ui/icons';
import { BrandMark, type ChromeBrand } from './BrandMark';
import { MobileNav } from './MobileNav';

export interface HeaderProps {
  /** Primary nav from site-content `nav.primary`. */
  nav: NavItem[];
  /** Items in the cart; shown next to the bag icon when > 0. */
  cartCount?: number;
  /**
   * Replaces the default bag link (e.g. a client button that opens the cart drawer).
   * WS-C can pass its own `<CartButton />` here.
   */
  cartSlot?: ReactNode;
  /** Search page path. */
  searchHref?: string;
  className?: string;
  /** Owner brand from settings (A9); defaults to the NOWHENCE wordmark. */
  brand?: ChromeBrand;
}

const iconBtn =
  'inline-flex h-10 min-w-10 items-center justify-center gap-1.5 text-ink transition-opacity duration-fast hover:opacity-60';

/** Sticky store header: wordmark centred, nav left (desktop), search + bag right. Hairline appears on scroll. */
export function Header({ nav, cartCount = 0, cartSlot, searchHref = '/search', className, brand }: HeaderProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname?.startsWith(href));

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header
        className={cn(
          'sticky top-0 z-header border-b bg-paper/95 backdrop-blur-sm transition-colors duration-base ease-out',
          scrolled ? 'border-line' : 'border-transparent',
          className,
        )}
      >
        <div className="container-page grid h-header grid-cols-[1fr_auto_1fr] items-center">
          <div className="flex items-center">
            <button
              type="button"
              className={cn(iconBtn, '-ml-2 lg:hidden')}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              onClick={() => setMenuOpen(true)}
            >
              <IconMenu />
            </button>
            <nav aria-label="Primary" className="hidden lg:block">
              <ul className="flex items-center gap-8">
                {nav.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive(item.href) ? 'page' : undefined}
                      className="link-underline py-1 text-micro uppercase text-ink"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <Link href="/" aria-label={`${brand?.name || 'Nowhence'}, home`} className="justify-self-center">
            <BrandMark brand={brand} />
          </Link>

          <div className="flex items-center justify-end gap-1 md:gap-3">
            <Link href={searchHref} aria-label="Search" className={iconBtn}>
              <IconSearch />
            </Link>
            {cartSlot ?? (
              <Link
                href="/cart"
                aria-label={cartCount > 0 ? `Bag, ${cartCount} item${cartCount === 1 ? '' : 's'}` : 'Bag, empty'}
                className={cn(iconBtn, '-mr-2')}
              >
                <IconBag />
                {cartCount > 0 && (
                  <span aria-hidden="true" className="text-caption tabular-nums">
                    {cartCount}
                  </span>
                )}
              </Link>
            )}
          </div>
        </div>
      </header>
      <MobileNav id="mobile-nav" open={menuOpen} onClose={() => setMenuOpen(false)} nav={nav} />
    </>
  );
}
