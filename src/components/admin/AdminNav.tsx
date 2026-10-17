import Link from 'next/link';
import type { AdminSubject } from '@/lib/admin-subject';
import { roleHas, ROLE_LABELS, type Capability } from '@/lib/roles';
import { LogoutButton } from './LoginForm';

const ITEMS: { href: string; label: string; cap?: Capability }[] = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/launches', label: 'Launches', cap: 'catalogue.write' },
  { href: '/admin/inventory', label: 'Inventory', cap: 'inventory.write' },
  { href: '/admin/orders', label: 'Orders', cap: 'orders.read' },
  { href: '/admin/bookings', label: 'Bookings', cap: 'orders.read' },
  { href: '/admin/coupons', label: 'Coupons & sales', cap: 'coupons.write' },
  { href: '/admin/content', label: 'Content' },
  { href: '/admin/media', label: 'Media', cap: 'media.write' },
  { href: '/admin/settings', label: 'Settings', cap: 'orders.read' },
  { href: '/admin/team', label: 'Team', cap: 'users.manage' },
  { href: '/admin/audit', label: 'Audit log', cap: 'audit.read' },
];

export function AdminNav({ admin }: { admin: AdminSubject }) {
  return (
    <nav aria-label="Studio" className="flex flex-col gap-6 border-r border-line p-6 text-sm">
      <Link href="/admin" className="font-display text-lg tracking-wide">
        NOWHENCE
      </Link>
      <ul className="space-y-2">
        {ITEMS.filter((i) => !i.cap || roleHas(admin.role, i.cap)).map((i) => (
          <li key={i.href}>
            <Link href={i.href} className="hover:underline">
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-auto space-y-1 text-xs text-muted">
        <p>{admin.email}</p>
        <p>{ROLE_LABELS[admin.role]}</p>
        {!admin.breakGlass && (
          <Link href="/admin/account" className="block underline">
            Account
          </Link>
        )}
        <LogoutButton />
      </div>
    </nav>
  );
}
