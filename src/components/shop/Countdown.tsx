'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/components/ui/cn';
import { countdownParts } from './merch';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Drop / launch countdown (S4). Refreshes the route at zero so the page becomes purchasable.
 * `label` names the moment: "Releases" (default, coming-soon reveal and drops), "Sale opens", "Pre-orders close".
 * `variant="inline"` is a single quiet line ("Sale opens 31 October · 13d 06:22:10") for strips and buy columns.
 */
export function Countdown({
  releaseAt,
  className,
  label: what = 'Releases',
  variant = 'block',
}: {
  releaseAt: string;
  className?: string;
  label?: string;
  /** 'clock': only the ticking time left, for places where the date is already written out beside it. */
  variant?: 'block' | 'inline' | 'clock';
}) {
  const router = useRouter();
  const target = new Date(releaseAt);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const parts = countdownParts(target, now ?? new Date(0));
  useEffect(() => {
    if (now && parts.done) router.refresh();
  }, [now, parts.done, router]);

  const label = target.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });

  if (variant === 'clock') {
    return (
      <p aria-hidden className={cn('tabular-nums', className)}>
        {now ? `${what} in ${parts.days}d ${pad(parts.hours)}:${pad(parts.minutes)}:${pad(parts.seconds)}` : ''}
      </p>
    );
  }

  if (variant === 'inline') {
    const day = target.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' });
    const time = target.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
    const clock = now ? `${parts.days}d ${pad(parts.hours)}:${pad(parts.minutes)}:${pad(parts.seconds)}` : '';
    return (
      <p className={cn('flex flex-wrap items-baseline gap-x-3 gap-y-1', className)}>
        {/* The sentence is the accessible version; the ticking clock is hidden from AT. */}
        <span>
          {what}{' '}
          <time dateTime={releaseAt}>
            {day}, {time} IST
          </time>
        </span>
        <span aria-hidden className="min-w-[9ch] tabular-nums text-ink">
          {clock}
        </span>
      </p>
    );
  }

  const cells: [number, string][] = [
    [parts.days, 'Days'],
    [parts.hours, 'Hrs'],
    [parts.minutes, 'Min'],
    [parts.seconds, 'Sec'],
  ];
  return (
    <div className={className}>
      <p className="text-label uppercase text-muted">
        {what} <time dateTime={releaseAt}>{label} IST</time>
      </p>
      {/* Visual ticker hidden from AT; the sentence above is the accessible version. */}
      <div aria-hidden className="mt-3 flex gap-6 font-display text-h3 font-light tabular-nums">
        {cells.map(([n, l]) => (
          <span key={l} className="flex flex-col items-start">
            {now ? pad(n) : '--'}
            <span className="mt-1 font-sans text-[10px] uppercase tracking-label text-muted">{l}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
