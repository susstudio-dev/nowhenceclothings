// Studio kit: page scaffolding for the admin, built on DESIGN.md tokens.
// Calm, dense, hairline-divided. Server-safe (no hooks).
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/components/ui/cn';

export const th = 'px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-label text-muted first:pl-4 last:pr-4';
export const td = 'px-3 py-3 align-top first:pl-4 last:pr-4';
export const tr = 'border-t border-line transition-colors duration-150 hover:bg-paper-deep/50';
export const field =
  'h-9 border border-line bg-paper px-3 text-sm text-ink placeholder:text-muted/70 focus:border-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-ink';
export const fieldLabel = 'flex flex-col gap-1.5 text-[10px] font-medium uppercase tracking-label text-muted';
export const btn =
  'inline-flex h-9 items-center justify-center gap-2 px-4 text-[11px] font-medium uppercase tracking-label transition-colors duration-150 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ink';
export const btnPrimary = cn(btn, 'bg-ink text-paper hover:bg-ink-soft');
export const btnSecondary = cn(btn, 'border border-line bg-paper text-ink hover:border-ink');

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-8 space-y-3">
      {back && (
        <Link
          href={back.href}
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-label text-muted transition-colors hover:text-ink"
        >
          <span aria-hidden>←</span> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 space-y-1">
          {eyebrow && <p className="text-[10px] uppercase tracking-label text-muted">{eyebrow}</p>}
          <h1 className="font-display text-[28px] font-light leading-tight tracking-tight text-ink md:text-[32px]">{title}</h1>
          {description && <div className="max-w-2xl text-sm text-muted">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  flush,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <section className={cn('border border-line bg-paper', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            {title && <h2 className="text-[11px] font-medium uppercase tracking-label text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-3 text-xs">{actions}</div>}
        </div>
      )}
      <div className={flush ? '' : 'p-4'}>{children}</div>
    </section>
  );
}

export function StatGrid({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const c = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }[cols];
  return <dl className={cn('grid grid-cols-2 gap-px border border-line bg-line', c)}>{children}</dl>;
}

export function Stat({ label, value, hint, href, tone }: { label: string; value: ReactNode; hint?: ReactNode; href?: string; tone?: 'alert' }) {
  const inner = (
    <>
      <dt className="flex items-center gap-2 text-[10px] uppercase tracking-label text-muted">
        {tone === 'alert' && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-sale" />}
        {label}
      </dt>
      <dd className="mt-3 font-display text-[28px] font-light tabular-nums leading-none text-ink">{value}</dd>
      {hint && <dd className="mt-2 text-xs text-muted">{hint}</dd>}
    </>
  );
  return href ? (
    <Link
      href={href}
      className="group block bg-paper p-4 transition-colors hover:bg-paper-deep/60 focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-ink"
    >
      {inner}
    </Link>
  ) : (
    <div className="bg-paper p-4">{inner}</div>
  );
}

export type ChipTone = 'neutral' | 'ink' | 'clay' | 'sale' | 'success' | 'muted';
const CHIP: Record<ChipTone, string> = {
  neutral: 'border-line text-ink-soft',
  ink: 'border-ink bg-ink text-paper',
  clay: 'border-clay/60 bg-clay-soft text-ink',
  sale: 'border-sale/50 text-sale',
  success: 'border-success/50 text-success',
  muted: 'border-line text-muted',
};
/** Care-label status chip. */
export function Chip({ children, tone = 'neutral', className }: { children: ReactNode; tone?: ChipTone; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center whitespace-nowrap border px-1.5 text-[10px] font-medium uppercase leading-none tracking-[0.14em]',
        CHIP[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const ORDER_TONES: Record<string, ChipTone> = {
  pending_payment: 'muted',
  paid: 'clay',
  packed: 'neutral',
  shipped: 'neutral',
  delivered: 'success',
  cancelled: 'muted',
  refunded: 'sale',
  exchange_requested: 'sale',
};
const BOOKING_TONES: Record<string, ChipTone> = {
  deposit_pending: 'muted',
  deposit_paid: 'clay',
  balance_due: 'sale',
  completed: 'success',
  cancelled: 'muted',
  expired: 'muted',
  refunded: 'sale',
  forfeited: 'muted',
};
export const orderTone = (s: string): ChipTone => ORDER_TONES[s] ?? 'neutral';
export const bookingTone = (s: string): ChipTone => BOOKING_TONES[s] ?? 'neutral';

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 border border-dashed border-line px-6 py-14 text-center">
      <svg aria-hidden width="28" height="28" viewBox="0 0 28 28" className="text-clay">
        <circle cx="14" cy="14" r="12" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="10.5" cy="14" r="1.3" fill="currentColor" />
        <circle cx="14" cy="14" r="1.3" fill="currentColor" />
        <circle cx="17.5" cy="14" r="1.3" fill="currentColor" />
      </svg>
      <p className="text-sm font-medium text-ink">{title}</p>
      {children && <div className="max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Callout({ tone = 'neutral', children, title }: { tone?: 'neutral' | 'alert' | 'clay'; title?: ReactNode; children: ReactNode }) {
  const t = { neutral: 'border-line bg-paper-deep/40', alert: 'border-sale/40 bg-sale/[0.04] text-ink', clay: 'border-clay/50 bg-clay-soft/50' }[tone];
  return (
    <div role={tone === 'alert' ? 'alert' : undefined} className={cn('flex gap-3 border px-4 py-3 text-sm', t)}>
      <span aria-hidden className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', tone === 'alert' ? 'bg-sale' : 'bg-clay')} />
      <div className="space-y-0.5">
        {title && <p className="font-medium">{title}</p>}
        <div className={title ? 'text-muted' : ''}>{children}</div>
      </div>
    </div>
  );
}

/** Underlined tab strip driven by links (server-safe). */
export function Tabs({ items, current, label }: { items: { key: string; label: string; href: string; count?: number }[]; current: string; label: string }) {
  return (
    <nav aria-label={label} className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
      {items.map((i) => {
        const on = i.key === current;
        return (
          <Link
            key={i.key}
            href={i.href}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'relative -mb-px whitespace-nowrap border-b px-3 py-2.5 text-[11px] uppercase tracking-label transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-ink',
              on ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {i.label}
            {i.count != null && <span className="ml-1.5 tabular-nums text-muted">{i.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto border border-line bg-paper', className)}>
      <table className="w-full min-w-[640px] text-sm">{children}</table>
    </div>
  );
}

export function DefList({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="divide-y divide-line text-sm">
      {rows.map(([k, v], i) => (
        <div key={i} className="grid grid-cols-[minmax(7rem,36%)_1fr] gap-4 py-2.5">
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0 break-words text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
