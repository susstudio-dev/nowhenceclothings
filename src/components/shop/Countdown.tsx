'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { countdownParts } from './merch';

/** Drop countdown (S4). Refreshes the route at zero so the page becomes purchasable. */
export function Countdown({ releaseAt, className }: { releaseAt: string; className?: string }) {
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
  const cells: [number, string][] = [
    [parts.days, 'Days'],
    [parts.hours, 'Hrs'],
    [parts.minutes, 'Min'],
    [parts.seconds, 'Sec'],
  ];
  return (
    <div className={className}>
      <p className="text-xs uppercase tracking-widest text-muted">
        Releases <time dateTime={releaseAt}>{label} IST</time>
      </p>
      {/* Visual ticker hidden from AT; the sentence above is the accessible version. */}
      <div aria-hidden className="mt-2 flex gap-4 font-display text-3xl tabular-nums">
        {cells.map(([n, l]) => (
          <span key={l} className="flex flex-col items-center">
            {now ? String(n).padStart(2, '0') : '--'}
            <span className="font-sans text-[10px] uppercase tracking-widest text-muted">{l}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
