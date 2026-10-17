import Link from 'next/link';
import { requireAdmin } from '@/lib/guard';
import { getCatalogue, getInventory } from '@/lib/catalogue';
import { roleHas } from '@/lib/roles';
import { formatPaise } from '@/lib/money';
import { stockRows } from '@/lib/admin/catalogue-mutations';
import { ORDER_STATUS_LABELS } from '@/lib/admin/orders';
import { listOrderSummaries } from '@/lib/admin/store';
import { getSettings } from '@/lib/content';
import { launchReadiness } from '@/lib/brand';
import { bookingTotals } from '@/lib/bookings';
import { listBookingSummaries } from '@/lib/bookings-server';
import { Chip, EmptyState, PageHeader, Panel, Stat, StatGrid, btnPrimary, btnSecondary, fmtDateTime, orderTone } from '@/components/admin/kit';

export const metadata = { title: 'Overview' };

const REVENUE_STATUSES = new Set(['paid', 'packed', 'shipped', 'delivered', 'exchange_requested']);
const istDay = (d: Date | string) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

export default async function AdminHome() {
  const admin = await requireAdmin();
  const [cat, inv, settings] = await Promise.all([getCatalogue(), getInventory(), getSettings()]);
  const readiness = launchReadiness(settings);
  const missing = readiness.filter((r) => !r.ok);
  const showOrders = roleHas(admin.role, 'orders.read');
  const low = stockRows(cat, inv, { lowOnly: true });
  const orders = showOrders ? await listOrderSummaries(2) : [];
  const today = istDay(new Date());
  const todays = orders.filter((o) => istDay(o.createdAt) === today);
  const revenueToday = todays.filter((o) => REVENUE_STATUSES.has(o.status)).reduce((n, o) => n + o.total, 0);
  const toPack = orders.filter((o) => o.status === 'paid');
  const bookings = showOrders ? bookingTotals(await listBookingSummaries().catch(() => [])) : null;
  const active = cat.products.filter((p) => p.status === 'active').length;
  const pct = Math.round(((readiness.length - missing.length) / Math.max(1, readiness.length)) * 100);
  const greeting = (() => {
    const h = Number(new Date().toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }));
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  })();
  const dateLine = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={dateLine}
        title={greeting}
        description={
          showOrders
            ? toPack.length
              ? `${toPack.length} paid order${toPack.length === 1 ? '' : 's'} waiting to be packed.`
              : 'Nothing waiting to be packed.'
            : undefined
        }
        actions={
          <>
            {showOrders && (
              <Link href="/admin/orders?status=paid" className={btnSecondary}>
                To pack
              </Link>
            )}
            {roleHas(admin.role, 'catalogue.write') && (
              <Link href="/admin/products/new" className={btnPrimary}>
                New product
              </Link>
            )}
          </>
        }
      />

      <StatGrid>
        {showOrders && <Stat label="Orders today" value={todays.length} hint={`${orders.length} in the last two months`} href="/admin/orders" />}
        {showOrders && <Stat label="Revenue today" value={formatPaise(revenueToday)} hint="Paid and later, incl. GST" />}
        {bookings && (
          <Stat
            label="Deposits held"
            value={formatPaise(bookings.depositsCollected)}
            hint={`${bookings.count} bookings · ${bookings.byStatus.balance_due ?? 0} balance due`}
            href="/admin/bookings"
            tone={(bookings.byStatus.balance_due ?? 0) > 0 ? 'alert' : undefined}
          />
        )}
        <Stat label="Active products" value={active} hint={`${cat.products.length} in catalogue`} href="/admin/products" />
        {!showOrders && <Stat label="Low-stock variants" value={low.length} href="/admin/inventory?low=1" tone={low.length ? 'alert' : undefined} />}
      </StatGrid>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {showOrders ? (
          <Panel
            title="Recent orders"
            actions={
              <Link href="/admin/orders" className="text-muted hover:text-ink">
                View all →
              </Link>
            }
            flush
          >
            {orders.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No orders yet">The first paid order will appear here the moment checkout completes.</EmptyState>
              </div>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {orders.slice(0, 8).map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-paper-deep/50 focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-ink sm:grid-cols-[7rem_1fr_auto_6rem]"
                    >
                      <span className="font-mono text-xs text-ink">{o.number}</span>
                      <span className="truncate">
                        {o.name}
                        <span className="ml-2 text-xs text-muted">{fmtDateTime(o.createdAt)}</span>
                      </span>
                      <span className="hidden sm:block">
                        <Chip tone={orderTone(o.status)}>{ORDER_STATUS_LABELS[o.status]}</Chip>
                      </span>
                      <span className="text-right tabular-nums">{formatPaise(o.total)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        ) : (
          <div />
        )}

        <div className="space-y-6">
          {showOrders && (
            <Panel
              title="Launch readiness"
              actions={<span className="tabular-nums text-muted">{readiness.length - missing.length}/{readiness.length}</span>}
            >
              <div className="mb-4 h-px w-full bg-line">
                <div className="h-px bg-ink transition-[width] duration-300" style={{ width: `${pct}%` }} />
              </div>
              {missing.length === 0 ? (
                <p className="text-sm text-muted">Every required owner setting is filled in.</p>
              ) : (
                <>
                  <p className="mb-3 text-xs text-muted">Until these are filled, the storefront shows a default.</p>
                  <ul className="space-y-1.5 text-sm">
                    {missing.slice(0, 8).map((m) => (
                      <li key={m.id} className="flex items-center gap-2">
                        <span aria-hidden className="h-3 w-3 shrink-0 border border-line" />
                        <Link href={`/admin/settings?tab=${m.tab}`} className="hover:underline">
                          {m.label}
                        </Link>
                      </li>
                    ))}
                    {missing.length > 8 && <li className="text-xs text-muted">and {missing.length - 8} more</li>}
                  </ul>
                </>
              )}
            </Panel>
          )}
          <Panel
            title="Low stock"
            actions={
              low.length > 0 && (
                <Link href="/admin/inventory?low=1" className="text-muted hover:text-ink">
                  All →
                </Link>
              )
            }
            flush
          >
            {low.length === 0 ? (
              <p className="p-4 text-sm text-muted">Every variant is above its threshold.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {low.slice(0, 8).map((r) => (
                  <li key={r.sku} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate">{r.productTitle}</span>
                      <span className="text-xs text-muted">
                        {r.colour} · {r.size}
                      </span>
                    </span>
                    <Chip tone={r.stock === 0 ? 'sale' : 'clay'}>{r.stock === 0 ? 'Out' : `${r.stock} left`}</Chip>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
