'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { AdminSubject } from '@/lib/admin-subject';
import { roleHas, ROLE_LABELS, type Capability } from '@/lib/roles';
import { cn } from '@/components/ui/cn';
import { LogoutButton } from './LoginForm';

type Item = { href: string; label: string; cap?: Capability };
const GROUPS: { label: string; items: Item[] }[] = [
  { label: '', items: [{ href: '/admin', label: 'Overview' }] },
  {
    label: 'Sell',
    items: [
      { href: '/admin/orders', label: 'Orders', cap: 'orders.read' },
      { href: '/admin/bookings', label: 'Bookings', cap: 'orders.read' },
      { href: '/admin/coupons', label: 'Coupons & sales', cap: 'coupons.write' },
    ],
  },
  {
    label: 'Catalogue',
    items: [
      { href: '/admin/products', label: 'Products' },
      { href: '/admin/launches', label: 'Launches', cap: 'catalogue.write' },
      { href: '/admin/inventory', label: 'Inventory', cap: 'inventory.write' },
      { href: '/admin/media', label: 'Media', cap: 'media.write' },
    ],
  },
  { label: 'Site', items: [{ href: '/admin/content', label: 'Content' }] },
  {
    label: 'Studio',
    items: [
      { href: '/admin/settings', label: 'Settings', cap: 'orders.read' },
      { href: '/admin/team', label: 'Team', cap: 'users.manage' },
      { href: '/admin/audit', label: 'Audit log', cap: 'audit.read' },
    ],
  },
];

function Mark() {
  return (
    <Link href="/admin" className="flex items-baseline gap-2 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-ink">
      <span className="font-display text-[13px] font-medium tracking-mark text-ink">NOWHENCE</span>
      <span className="text-[10px] uppercase tracking-label text-muted">Studio</span>
    </Link>
  );
}

export function AdminNav({ admin }: { admin: AdminSubject }) {
  const path = usePathname() ?? '/admin';
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const isOn = (href: string) => (href === '/admin' ? path === '/admin' : path === href || path.startsWith(`${href}/`));

  const body = (
    <>
      <div className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {GROUPS.map((g) => {
          const items = g.items.filter((i) => !i.cap || roleHas(admin.role, i.cap));
          if (!items.length) return null;
          return (
            <div key={g.label || 'root'}>
              {g.label && <p className="mb-1.5 px-3 text-[10px] uppercase tracking-label text-muted/80">{g.label}</p>}
              <ul className="space-y-px">
                {items.map((i) => {
                  const on = isOn(i.href);
                  return (
                    <li key={i.href}>
                      <Link
                        href={i.href}
                        aria-current={on ? 'page' : undefined}
                        className={cn(
                          'relative flex h-8 items-center px-3 text-[13px] transition-colors duration-150 focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-ink',
                          on ? 'bg-paper-deep text-ink' : 'text-ink-soft hover:bg-paper-deep/60 hover:text-ink',
                        )}
                      >
                        {on && <span aria-hidden className="absolute inset-y-1.5 left-0 w-px bg-ink" />}
                        {i.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      <div className="border-t border-line px-6 py-4 text-xs">
        <p className="truncate text-ink" title={admin.email}>
          {admin.email}
        </p>
        <p className="mt-0.5 text-[10px] uppercase tracking-label text-muted">{ROLE_LABELS[admin.role]}</p>
        <div className="mt-3 flex gap-4 text-muted">
          {!admin.breakGlass && (
            <Link href="/admin/account" className="hover:text-ink">
              Account
            </Link>
          )}
          <Link href="/" target="_blank" className="hover:text-ink">
            View store ↗
          </Link>
          <LogoutButton />
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-paper/95 px-4 backdrop-blur md:hidden">
        <Mark />
        <button
          type="button"
          aria-expanded={open}
          aria-controls="studio-nav"
          onClick={() => setOpen((v) => !v)}
          className="h-9 px-2 text-[11px] uppercase tracking-label focus-visible:outline focus-visible:outline-1 focus-visible:outline-ink"
        >
          {open ? 'Close' : 'Menu'}
        </button>
      </div>
      {open && (
        <nav id="studio-nav" aria-label="Studio" className="fixed inset-x-0 bottom-0 top-14 z-30 flex flex-col bg-paper md:hidden">
          {body}
        </nav>
      )}
      {/* Desktop rail */}
      <nav aria-label="Studio" className="sticky top-0 hidden h-screen flex-col border-r border-line bg-paper md:flex">
        <div className="flex h-14 items-center border-b border-line px-6">
          <Mark />
        </div>
        {body}
      </nav>
    </>
  );
}
