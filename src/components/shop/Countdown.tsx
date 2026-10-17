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
      <p className="text-label uppercase text-muted">
        Releases <time dateTime={releaseAt}>{label} IST</time>
      </p>
      {/* Visual ticker hidden from AT; the sentence above is the accessible version. */}
      <div aria-hidden className="mt-3 flex gap-6 font-display text-h3 font-light tabular-nums">
        {cells.map(([n, l]) => (
          <span key={l} className="flex flex-col items-start">
            {now ? String(n).padStart(2, '0') : '--'}
            <span className="mt-1 font-sans text-[10px] uppercase tracking-label text-muted">{l}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
