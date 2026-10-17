'use client';
import Link from 'next/link';
import type { NavItem } from '@/lib/schemas/site-content';
import { Drawer } from '@/components/ui/Drawer';

export interface MobileNavProps {
  id?: string;
  open: boolean;
  onClose: () => void;
  nav: NavItem[];
}

/** Left drawer menu for < lg. Top-level items set in the display serif; children as a quiet list. */
export function MobileNav({ id, open, onClose, nav }: MobileNavProps) {
  return (
    <Drawer open={open} onClose={onClose} title="Menu" side="left">
      <nav id={id} aria-label="Mobile">
        <ul className="flex flex-col gap-6">
          {nav.map((item, i) => (
            <li
              key={item.href}
              className="animate-rise-in"
              style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
            >
              <Link href={item.href} onClick={onClose} className="font-display text-h3 text-ink">
                {item.label}
              </Link>
              {item.children.length > 0 && (
                <ul className="mt-3 flex flex-col gap-2">
                  {item.children.map((c) => (
                    <li key={c.href}>
                      <Link href={c.href} onClick={onClose} className="text-small text-muted hover:text-ink">
                        {c.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-12 border-t border-line pt-6">
          <Link href="/search" onClick={onClose} className="eyebrow hover:text-ink">
            Search
          </Link>
        </div>
      </nav>
    </Drawer>
  );
}
